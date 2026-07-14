package com.zkbrowser.controller;

import com.zkbrowser.model.ApiResponse;
import com.zkbrowser.model.ZkNodeInfo;
import com.zkbrowser.model.ZkStatInfo;
import com.zkbrowser.service.ZkService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * ZooKeeper 操作 REST API
 */
@RestController
@RequestMapping("/api")
@CrossOrigin
public class ZkController {

    private static final Logger log = LoggerFactory.getLogger(ZkController.class);

    private final ZkService zkService;

    public ZkController(ZkService zkService) {
        this.zkService = zkService;
    }

    /**
     * 测试连接 — POST /api/connect
     */
    @PostMapping("/connect")
    public ApiResponse<Map<String, Object>> connect(@RequestBody Map<String, String> body) {
        String address = body.get("address");
        if (isBlank(address)) {
            return ApiResponse.fail("地址不能为空");
        }
        try {
            zkService.testConnection(address);
            Map<String, Object> result = new HashMap<>();
            result.put("connected", true);
            return ApiResponse.ok(result);
        } catch (Exception e) {
            log.warn("ZK connect failed: {}", e.getMessage());
            return ApiResponse.fail("连接失败: " + e.getMessage());
        }
    }

    /**
     * 获取子节点列表 — GET /api/children?address=xxx&path=/
     */
    @GetMapping("/children")
    public ApiResponse<List<String>> getChildren(
            @RequestParam String address,
            @RequestParam(defaultValue = "/") String path) {
        try {
            return ApiResponse.ok(zkService.getChildren(address, path));
        } catch (Exception e) {
            log.warn("Get children failed: address={}, path={}, error={}", address, path, e.getMessage());
            return ApiResponse.fail(e.getMessage());
        }
    }

    /**
     * 获取节点完整信息 — GET /api/node?address=xxx&path=/
     */
    @GetMapping("/node")
    public ApiResponse<ZkNodeInfo> getNode(
            @RequestParam String address,
            @RequestParam String path) {
        try {
            return ApiResponse.ok(zkService.getNode(address, path));
        } catch (Exception e) {
            log.warn("Get node failed: address={}, path={}, error={}", address, path, e.getMessage());
            return ApiResponse.fail(e.getMessage());
        }
    }

    /**
     * 创建节点 — POST /api/node
     * Body: { "address": "xxx", "path": "/xxx", "data": "...", "mode": "PERSISTENT" }
     */
    @PostMapping("/node")
    public ApiResponse<String> createNode(@RequestBody Map<String, String> body) {
        String address = body.get("address");
        String path = body.get("path");
        String data = body.getOrDefault("data", "");
        String mode = body.getOrDefault("mode", "PERSISTENT");

        if (isBlank(address)) {
            return ApiResponse.fail("地址不能为空");
        }
        if (isBlank(path)) {
            return ApiResponse.fail("路径不能为空");
        }

        try {
            String createdPath = zkService.createNode(address, path, data, mode);
            return ApiResponse.ok(createdPath);
        } catch (Exception e) {
            log.warn("Create node failed: address={}, path={}, error={}", address, path, e.getMessage());
            return ApiResponse.fail(e.getMessage());
        }
    }

    /**
     * 更新节点数据 — PUT /api/node
     * Body: { "address": "xxx", "path": "/xxx", "data": "..." }
     */
    @PutMapping("/node")
    public ApiResponse<ZkStatInfo> updateNode(@RequestBody Map<String, String> body) {
        String address = body.get("address");
        String path = body.get("path");
        String data = body.getOrDefault("data", "");

        if (isBlank(address)) {
            return ApiResponse.fail("地址不能为空");
        }
        if (isBlank(path)) {
            return ApiResponse.fail("路径不能为空");
        }

        try {
            ZkStatInfo stat = zkService.setData(address, path, data);
            return ApiResponse.ok(stat);
        } catch (Exception e) {
            log.warn("Update node failed: address={}, path={}, error={}", address, path, e.getMessage());
            return ApiResponse.fail(e.getMessage());
        }
    }

    /**
     * 删除节点 — DELETE /api/node?address=xxx&path=/xxx
     */
    @DeleteMapping("/node")
    public ApiResponse<Void> deleteNode(
            @RequestParam String address,
            @RequestParam String path) {
        try {
            zkService.deleteNode(address, path);
            return ApiResponse.ok();
        } catch (Exception e) {
            log.warn("Delete node failed: address={}, path={}, error={}", address, path, e.getMessage());
            return ApiResponse.fail(e.getMessage());
        }
    }

    /**
     * 判断字符串是否为空（null 或去空格后为空）
     */
    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }
}
