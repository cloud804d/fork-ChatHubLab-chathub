## koishi-plugin-chathub-embeddings-service

## [![npm](https://img.shields.io/npm/v/@dingyi222666/koishi-plugin-chathub-embeddings-service)](https://www.npmjs.com/package/@dingyi222666/koishi-plugin-chathub-embeddings-service) [![npm](https://img.shields.io/npm/dt/@dingyi222666/koishi-plugin-chathub-embeddings-service)](https://www.npmjs.com/package//@dingyi222666/koishi-plugin-chathub-embeddings-service)

> 提供模型注入数据的搜索服务的插件

## 怎么使用？

1. 在插件市场安装本插件(`chathub-embeddings-service`)，并安装好本插件依赖的前置插件
2. 在插件的配置项选择你要使用的平台/模型，填写相关配置后启用本插件
3. 就可以调用`chathub.listembeddings`，列举embeddings模型列表，再调用`chathub.setembeddings`，设置embeddings模型了。