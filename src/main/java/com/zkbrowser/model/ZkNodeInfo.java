package com.zkbrowser.model;

import java.util.List;

/**
 * ZK 节点完整信息
 */
public class ZkNodeInfo {

    private String path;           // 节点路径
    private String data;           // 节点数据（UTF-8 解码）
    private String dataFormat;     // 数据格式：text / json / binary
    private boolean ephemeral;     // 是否临时节点
    private boolean sequential;    // 是否顺序节点
    private List<String> children; // 子节点列表
    private ZkStatInfo stat;       // stat 信息

    // --- getters & setters ---

    public String getPath() { return path; }
    public void setPath(String path) { this.path = path; }

    public String getData() { return data; }
    public void setData(String data) { this.data = data; }

    public String getDataFormat() { return dataFormat; }
    public void setDataFormat(String dataFormat) { this.dataFormat = dataFormat; }

    public boolean isEphemeral() { return ephemeral; }
    public void setEphemeral(boolean ephemeral) { this.ephemeral = ephemeral; }

    public boolean isSequential() { return sequential; }
    public void setSequential(boolean sequential) { this.sequential = sequential; }

    public List<String> getChildren() { return children; }
    public void setChildren(List<String> children) { this.children = children; }

    public ZkStatInfo getStat() { return stat; }
    public void setStat(ZkStatInfo stat) { this.stat = stat; }
}
