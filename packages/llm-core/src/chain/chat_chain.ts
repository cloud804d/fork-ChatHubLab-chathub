import { LLMChain } from 'langchain';
import { BaseChatModel } from 'langchain/chat_models/base';
import { HumanChatMessage, AIChatMessage, BaseChatMessageHistory, ChainValues, SystemChatMessage } from 'langchain/schema';
import { BufferMemory, ConversationSummaryMemory } from "langchain/memory";
import { VectorStoreRetrieverMemory } from 'langchain/memory';
import { ChatHubChain, SystemPrompts } from './base';
import { AIMessagePromptTemplate, ChatPromptTemplate, HumanMessagePromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate } from 'langchain/prompts';
import { VectorStoreRetriever } from 'langchain/vectorstores/base';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { FakeEmbeddings } from 'langchain/embeddings/fake';
import { BaseMessageStringPromptTemplate, ChatPromptValue } from 'langchain/dist/prompts/chat';
import { calculateMaxTokens, getModelContextSize } from '../utils/count_tokens';
import { ChatHubChatPrompt } from './prompt';


export interface ChatHubChatChainInput {
    botName: string;
    systemPrompts?: SystemPrompts
    longMemory?: VectorStoreRetrieverMemory;

    historyMemory: ConversationSummaryMemory | BufferMemory
}

export class ChatHubChatChain extends ChatHubChain
    implements ChatHubChatChainInput {
    botName: string;

    longMemory: VectorStoreRetrieverMemory;

    chain: LLMChain;

    historyMemory: ConversationSummaryMemory | BufferMemory

    systemPrompts?: SystemPrompts;

    constructor({
        botName,
        longMemory,
        historyMemory,
        systemPrompts,
        chain,
    }: ChatHubChatChainInput & {
        chain: LLMChain;
    }) {
        super();
        this.botName = botName;

        // roll back to the empty memory if not set
        this.longMemory = longMemory ?? new VectorStoreRetrieverMemory({
            vectorStoreRetriever: new VectorStoreRetriever({
                vectorStore: new MemoryVectorStore(new FakeEmbeddings())
            }),
            inputKey: "long_history",
        });
        this.historyMemory = historyMemory;
        this.systemPrompts = systemPrompts;
        this.chain = chain;
    }

    static fromLLM(
        llm: BaseChatModel,
        {
            botName,
            longMemory,
            historyMemory,
            systemPrompts,
        }: ChatHubChatChainInput
    ): ChatHubChatChain {
        // if not set the system prompts, use the default prompts


        let humanMessagePromptTemplate = HumanMessagePromptTemplate.fromTemplate("{input}")


        let conversationSummaryPrompt: SystemMessagePromptTemplate
        let messagesPlaceholder: MessagesPlaceholder

        if (historyMemory instanceof ConversationSummaryMemory) {
            conversationSummaryPrompt = SystemMessagePromptTemplate.fromTemplate(`This is a conversation between me and you. Please generate a response based on the system prompt and content below.Relevant pieces of previous conversation: {long_history} (You do not need to use these pieces of information if not relevant) Current conversation: {chat_history}`)


        } else {
            conversationSummaryPrompt = SystemMessagePromptTemplate.fromTemplate(`This is a conversation between me and you. Please generate a response based on the system prompt and content below.Relevant pieces of previous conversation: {long_history} (You do not need to use these pieces of information if not relevant)`)



            messagesPlaceholder = new MessagesPlaceholder("chat_history")

        }


        const prompt = new ChatHubChatPrompt({
            systemPrompts: systemPrompts ?? [new SystemChatMessage("You are ChatGPT, a large language model trained by OpenAI. Carefully heed the user's instructions.")],
            conversationSummaryPrompt: conversationSummaryPrompt,
            messagesPlaceholder: messagesPlaceholder,
            tokenCounter: (text) => llm.getNumTokens(text),
            humanMessagePromptTemplate: humanMessagePromptTemplate,
            sendTokenLimit: getModelContextSize(llm._modelType() ?? "gpt2"),
        })

        const chain = new LLMChain({ llm, prompt });

        return new ChatHubChatChain({
            botName,
            longMemory,
            historyMemory,
            systemPrompts,
            chain,
        });
    }

    async call(message: HumanChatMessage): Promise<ChainValues> {
        const requests: ChainValues = {
            input: message.text,
        }
        const chatHistory = await this.historyMemory.loadMemoryVariables(requests)
        const longHistory = await this.longMemory.loadMemoryVariables(requests)

        requests["chat_history"] = chatHistory[this.historyMemory.memoryKey]
        requests["long_history"] = longHistory[this.longMemory.memoryKey]

        const response = await this.chain.call(requests);

        const responseString = response[this.chain.outputKey]

        /* await this.historyMemory.chatHistory.addUserMessage(message.text)

        await this.historyMemory.chatHistory.addAIChatMessage(responseString) */

        await this.historyMemory.saveContext({
            [this.historyMemory.inputKey]: message.text,
        }, {
            [this.historyMemory.outputKey]: responseString
        })

        const aiMessage = new AIChatMessage(responseString);
        response.message = aiMessage

        return response
    }




}