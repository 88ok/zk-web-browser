package com.zkbrowser.model;

/**
 * 统一 API 响应封装
 */
public class ApiResponse<T> {

    private boolean success;
    private String message;
    private T data;

    public ApiResponse() {
    }

    public ApiResponse(boolean success, String message, T data) {
        this.success = success;
        this.message = message;
        this.data = data;
    }

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, null, data);
    }

    public static <T> ApiResponse<T> ok() {
        return new ApiResponse<>(true, null, null);
    }

    public static <T> ApiResponse<T> fail(String message) {
        return new ApiResponse<>(false, message, null);
    }

    // --- getters ---

    public boolean isSuccess() {
        return success;
    }

    public String getMessage() {
        return message;
    }

    public T getData() {
        return data;
    }
}
