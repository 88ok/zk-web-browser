package com.zkbrowser.service;

import com.zkbrowser.model.ZkNodeInfo;
import com.zkbrowser.model.ZkStatInfo;
import javax.annotation.PreDestroy;
import org.apache.zookeeper.*;
import org.apache.zookeeper.data.Stat;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * ZooKeeper 连接管理与操作服务
 * <p>
 * 维护一个 address -> ZooKeeper 客户端的连接池，复用连接。
 * 连接断开 / 过期后自动从池中移除，下次请求时重建。
 */
@Service
public class ZkService {

    private static final Logger log = LoggerFactory.getLogger(ZkService.class);

    /** 连接超时（秒） */
    private static final int CONNECT_TIMEOUT_SECONDS = 10;
    /** 会话超时（毫秒） */
    private static final int SESSION_TIMEOUT_MS = 30_000;

    /** 连接池：address -> ZooKeeper 实例 */
    private final Map<String, ZooKeeper> connections = new ConcurrentHashMap<>();

    /**
     * 获取或创建 ZK 连接
     */
    private ZooKeeper getZk(String address) throws Exception {
        ZooKeeper zk = connections.get(address);
        if (zk != null && zk.getState().isConnected()) {
            return zk;
        }
        // 移除失效连接
        if (zk != null) {
            try { zk.close(); } catch (Exception ignored) {}
            connections.remove(address, zk);
        }

        // 建立新连接
        CountDownLatch latch = new CountDownLatch(1);
        ZooKeeper newZk = new ZooKeeper(address, SESSION_TIMEOUT_MS, event -> {
            if (event.getState() == Watcher.Event.KeeperState.SyncConnected) {
                latch.countDown();
            } else if (event.getState() == Watcher.Event.KeeperState.Expired ||
                       event.getState() == Watcher.Event.KeeperState.Disconnected) {
                // 会话过期或断开，从池中移除
                connections.remove(address);
                log.warn("ZK connection lost: address={}, state={}", address, event.getState());
            }
        });

        if (!latch.await(CONNECT_TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
            newZk.close();
            throw new RuntimeException("连接超时，请检查地址 " + address + " 是否可达");
        }

        connections.put(address, newZk);
        log.info("ZK connected: {}", address);
        return newZk;
    }

    /**
     * 测试连接
     */
    public void testConnection(String address) throws Exception {
        getZk(address);
    }

    /**
     * 获取子节点列表
     */
    public List<String> getChildren(String address, String path) throws Exception {
        ZooKeeper zk = getZk(address);
        List<String> children = zk.getChildren(path, false);
        Collections.sort(children);
        return children;
    }

    /**
     * 获取节点完整信息（数据 + stat + 子节点列表）
     */
    public ZkNodeInfo getNode(String address, String path) throws Exception {
        ZooKeeper zk = getZk(address);

        Stat stat = new Stat();
        byte[] dataBytes;
        try {
            dataBytes = zk.getData(path, false, stat);
        } catch (KeeperException.NoNodeException e) {
            throw new RuntimeException("节点不存在: " + path);
        }

        ZkNodeInfo info = new ZkNodeInfo();
        info.setPath(path);

        // 解析数据格式
        if (dataBytes == null || dataBytes.length == 0) {
            info.setData("");
            info.setDataFormat("empty");
        } else {
            String text = new String(dataBytes, StandardCharsets.UTF_8);
            info.setData(text);
            info.setDataFormat(detectFormat(dataBytes, text));
        }

        // 节点类型
        info.setEphemeral(stat.getEphemeralOwner() != 0);
        info.setSequential(path.matches(".*/.+-\\d{10}$"));

        // 子节点列表
        List<String> children = zk.getChildren(path, false);
        Collections.sort(children);
        info.setChildren(children);

        // stat 信息
        info.setStat(toStatInfo(stat));

        return info;
    }

    /**
     * 创建节点
     */
    public String createNode(String address, String path, String data, String mode) throws Exception {
        ZooKeeper zk = getZk(address);
        byte[] dataBytes = (data == null || data.isEmpty()) ? new byte[0] : data.getBytes(StandardCharsets.UTF_8);
        CreateMode createMode = parseCreateMode(mode);
        return zk.create(path, dataBytes, ZooDefs.Ids.OPEN_ACL_UNSAFE, createMode);
    }

    /**
     * 更新节点数据
     */
    public ZkStatInfo setData(String address, String path, String data) throws Exception {
        ZooKeeper zk = getZk(address);
        byte[] dataBytes = (data == null || data.isEmpty()) ? new byte[0] : data.getBytes(StandardCharsets.UTF_8);
        Stat stat = zk.setData(path, dataBytes, -1);
        return toStatInfo(stat);
    }

    /**
     * 删除节点
     */
    public void deleteNode(String address, String path) throws Exception {
        ZooKeeper zk = getZk(address);
        zk.delete(path, -1);
    }

    // --- 内部方法 ---

    private ZkStatInfo toStatInfo(Stat stat) {
        ZkStatInfo info = new ZkStatInfo();
        info.setCzxid(stat.getCzxid());
        info.setMzxid(stat.getMzxid());
        info.setCtime(stat.getCtime());
        info.setMtime(stat.getMtime());
        info.setVersion(stat.getVersion());
        info.setCversion(stat.getCversion());
        info.setAversion(stat.getAversion());
        info.setEphemeralOwner(stat.getEphemeralOwner());
        info.setDataLength(stat.getDataLength());
        info.setNumChildren(stat.getNumChildren());
        info.setPzxid(stat.getPzxid());
        return info;
    }

    private String detectFormat(byte[] bytes, String text) {
        // 检查是否为可打印文本
        boolean printable = true;
        for (byte b : bytes) {
            // 允许 tab, 换行, 回车, 以及可打印 ASCII
            if (b != '\t' && b != '\n' && b != '\r') {
                if (b < 32 || b > 126) {
                    // 允许 UTF-8 多字节字符（高位字节）
                    if ((b & 0x80) == 0) {
                        printable = false;
                        break;
                    }
                }
            }
        }
        if (!printable) {
            return "binary";
        }
        // 尝试 JSON 解析
        String trimmed = text.trim();
        if ((trimmed.startsWith("{") && trimmed.endsWith("}")) ||
            (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
            return "json";
        }
        return "text";
    }

    private CreateMode parseCreateMode(String mode) {
        if (mode == null) return CreateMode.PERSISTENT;
        switch (mode.toUpperCase()) {
            case "EPHEMERAL":
                return CreateMode.EPHEMERAL;
            case "PERSISTENT_SEQUENTIAL":
                return CreateMode.PERSISTENT_SEQUENTIAL;
            case "EPHEMERAL_SEQUENTIAL":
                return CreateMode.EPHEMERAL_SEQUENTIAL;
            case "CONTAINER":
                return CreateMode.CONTAINER;
            default:
                return CreateMode.PERSISTENT;
        }
    }

    /**
     * 关闭所有连接
     */
    @PreDestroy
    public void destroy() {
        log.info("Closing all ZK connections...");
        connections.forEach((address, zk) -> {
            try {
                zk.close();
                log.info("ZK connection closed: {}", address);
            } catch (Exception e) {
                log.warn("Failed to close ZK connection: {}", address, e);
            }
        });
        connections.clear();
    }
}
