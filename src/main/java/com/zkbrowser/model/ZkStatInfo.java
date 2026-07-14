package com.zkbrowser.model;

/**
 * ZK 节点 stat 信息
 */
public class ZkStatInfo {

    private long czxid;          // 创建该节点的事务 zxid
    private long mzxid;          // 最后一次更新该节点的事务 zxid
    private long ctime;          // 创建时间（毫秒时间戳）
    private long mtime;          // 最后一次更新时间（毫秒时间戳）
    private int version;         // 数据版本号
    private int cversion;        // 子节点版本号
    private int aversion;        // ACL 版本号
    private long ephemeralOwner; // 临时节点的会话 ID，持久节点为 0
    private int dataLength;      // 数据长度（字节）
    private int numChildren;     // 子节点数量
    private long pzxid;          // 最后一次修改子节点列表的事务 zxid

    // --- getters ---

    public long getCzxid() { return czxid; }
    public void setCzxid(long czxid) { this.czxid = czxid; }

    public long getMzxid() { return mzxid; }
    public void setMzxid(long mzxid) { this.mzxid = mzxid; }

    public long getCtime() { return ctime; }
    public void setCtime(long ctime) { this.ctime = ctime; }

    public long getMtime() { return mtime; }
    public void setMtime(long mtime) { this.mtime = mtime; }

    public int getVersion() { return version; }
    public void setVersion(int version) { this.version = version; }

    public int getCversion() { return cversion; }
    public void setCversion(int cversion) { this.cversion = cversion; }

    public int getAversion() { return aversion; }
    public void setAversion(int aversion) { this.aversion = aversion; }

    public long getEphemeralOwner() { return ephemeralOwner; }
    public void setEphemeralOwner(long ephemeralOwner) { this.ephemeralOwner = ephemeralOwner; }

    public int getDataLength() { return dataLength; }
    public void setDataLength(int dataLength) { this.dataLength = dataLength; }

    public int getNumChildren() { return numChildren; }
    public void setNumChildren(int numChildren) { this.numChildren = numChildren; }

    public long getPzxid() { return pzxid; }
    public void setPzxid(long pzxid) { this.pzxid = pzxid; }
}
