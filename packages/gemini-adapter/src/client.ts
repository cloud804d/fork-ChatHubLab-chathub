import { PlatformModelAndEmbeddingsClient } from 'koishi-plugin-chatluna/lib/llm-core/platform/client'
import { ClientConfig } from 'koishi-plugin-chatluna/lib/llm-core/platform/config'
import {
    ChatHubBaseEmbeddings,
    ChatLunaChatModel,
    ChatLunaEmbeddings
} from 'koishi-plugin-chatluna/lib/llm-core/platform/model'
import {
    ModelInfo,
    ModelType
} from 'koishi-plugin-chatluna/lib/llm-core/platform/types'
import { Context } from 'koishi'
import { Config } from '.'
import {
    ChatLunaError,
    ChatLunaErrorCode
} from 'koishi-plugin-chatluna/lib/utils/error'
import { GeminiRequester } from './requester'

export class GeminiClient extends PlatformModelAndEmbeddingsClient<ClientConfig> {
    platform = 'gemini'

    private _requester: GeminiRequester

    private _models: Record<string, ModelInfo>

    constructor(
        ctx: Context,
        private _config: Config,
        clientConfig: ClientConfig
    ) {
        super(ctx, clientConfig)

        this._requester = new GeminiRequester(clientConfig)
    }

    async init(): Promise<void> {
        await this.getModels()
    }

    async refreshModels(): Promise<ModelInfo[]> {
        try {
            const rawModels = await this._requester.getModels()

            if (!rawModels.length) {
                throw new ChatLunaError(
                    ChatLunaErrorCode.MODEL_INIT_ERROR,
                    new Error('No model found')
                )
            }

            return rawModels
                .map((model) => model.replace('models/', ''))
                .map((model) => {
                    return {
                        name: model,
                        maxTokens: model.includes('vision') ? 12288 : 30720,
                        type: model.includes('embedding')
                            ? ModelType.embeddings
                            : ModelType.llm,
                        functionCall: !model.includes('vision'),
                        supportMode: ['all']
                    }
                })
        } catch (e) {
            throw new ChatLunaError(ChatLunaErrorCode.MODEL_INIT_ERROR, e)
        }
    }

    async getModels(): Promise<ModelInfo[]> {
        if (this._models) {
            return Object.values(this._models)
        }

        const models = await this.refreshModels()

        this._models = {}

        for (const model of models) {
            this._models[model.name] = model
        }
    }

    protected _createModel(
        model: string
    ): ChatLunaChatModel | ChatHubBaseEmbeddings {
        const info = this._models[model]

        if (info == null) {
            throw new ChatLunaError(ChatLunaErrorCode.MODEL_NOT_FOUND)
        }

        if (info.type === ModelType.llm) {
            return new ChatLunaChatModel({
                modelInfo: info,
                requester: this._requester,
                model,
                maxTokens: this._config.maxTokens,
                timeout: this._config.timeout,
                temperature: this._config.temperature,
                maxRetries: this._config.maxRetries,
                llmType: 'gemini'
            })
        }

        return new ChatLunaEmbeddings({
            client: this._requester,
            maxRetries: this._config.maxRetries
        })
    }
}
