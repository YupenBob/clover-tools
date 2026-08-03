# API接口文档怎么写？OpenAPI/Swagger完整指南

> 好的API文档是前后端协作的关键。本文讲解如何使用OpenAPI/Swagger规范编写接口文档，包含认证、参数校验、响应示例等实战内容。

## OpenAPI基础结构

```
openapi: 3.0.0
info:
  title: 用户API
  version: 1.0.0
  description: 用户管理接口
paths:
  /users:
    get:
      summary: 获取用户列表
```

## GET请求示例

```
/users:
  get:
    tags:
      - Users
    summary: 获取用户列表
    parameters:
      - name: page
        in: query
        schema:
          type: integer
          default: 1
      - name: limit
        in: query
        schema:
          type: integer
          default: 20
    responses:
      '200':
        description: 成功
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: array
                  items:
                    $ref: '#/components/schemas/User'
```

## POST请求示例

```
/users:
  post:
    summary: 创建用户
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required:
              - email
              - password
            properties:
              email:
                type: string
                format: email
              password:
                type: string
                minLength: 6
    responses:
      '201':
        description: 创建成功
```

## 认证配置

```
components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

paths:
  /profile:
    get:
      security:
        - BearerAuth: []
```

## 在线工具

使用CloverTools JSON格式化工具验证API响应：打开工具

---

## 相关工具推荐

**HTTP 接口测试** — 构造请求调试接口，查看响应与耗时。

在线使用：[HTTP 接口测试](https://clovertools.cn/tools/dev/http-tester/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
