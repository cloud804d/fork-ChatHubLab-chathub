import { Context } from 'koishi';
import { Config } from '../config';
import { ChainMiddlewareRunStatus, ChatChain } from '../chain';
import { createLogger } from '@dingyi222666/chathub-llm-core/lib/utils/logger';
import { Message } from '../types';
import { formatPresetTemplateString, loadPreset } from '@dingyi222666/chathub-llm-core/lib/prompt/preset_prompt_parse'
const logger = createLogger("@dingyi222666/chathub/middlewares/request_model")


export function apply(ctx: Context, config: Config, chain: ChatChain) {
    chain.middleware("request_model", async (session, context) => {

        const conversationInfo = context.options.conversationInfo


        if (conversationInfo.model == null) {
            throw new Error("Can't find model")
        }

        await (new Promise(async (resolve, reject) => {
            setTimeout(() => {
                resolve("")
            }, 1000 * 13)
        }))


        const presetTemplate = loadPreset(context.options.conversationInfo.systemPrompts)

        if (presetTemplate.formatUserPromptString != null) {
            context.message = formatPresetTemplateString(presetTemplate.formatUserPromptString, {
                sender: session.username,
                prompt: context.message as string
            })
        }

        context.options.responseMessage = await ctx.chathub.chat(
            conversationInfo,
            {
                name: session.username,
                text: context.message as string
            })

        logger.debug(`[request_model] responseMessage: ${context.options.responseMessage.text}`)

        return ChainMiddlewareRunStatus.CONTINUE
    }).after("lifecycle-request_model")
}

declare module '../chain' {
    interface ChainMiddlewareName {
        "request_model": never
    }

    interface ChainMiddlewareContextOptions {
        responseMessage?: Message
    }
}