import './fetch-polyfill'

import {info, setFailed, warning} from '@actions/core'
import {
  ChatGPTAPI,
  ChatGPTError,
  ChatMessage,
  SendMessageOptions
  // eslint-disable-next-line import/no-unresolved
} from 'chatgpt'
import {createOpenAI} from '@ai-sdk/openai'
import {createMistral} from '@ai-sdk/mistral'
import {generateText} from 'ai'
import pRetry from 'p-retry'
import {OpenAIOptions, Options} from './options'

// define type to save parentMessageId and conversationId
export interface Ids {
  parentMessageId?: string
  conversationId?: string
}

export class Bot {
  private readonly api: ChatGPTAPI | null = null // not free
  private readonly useFireworks: boolean = false
  private readonly useMistral: boolean = false
  private readonly fireworksModel: string = ''
  private readonly fireworksApiKey: string = ''
  private readonly mistralModel: string = ''
  private readonly mistralApiKey: string = ''
  private readonly options: Options

  constructor(options: Options, openaiOptions: OpenAIOptions) {
    this.options = options
    
    // Priority order: Mistral > Fireworks > OpenAI
    // Each provider is used if their API key is available
    if (process.env.MISTRAL_API_KEY) {
      this.useMistral = true
      this.mistralApiKey = process.env.MISTRAL_API_KEY
      this.mistralModel = openaiOptions.model
      // Auto-set base URL only if using the default OpenAI URL
      if (options.apiBaseUrl === 'https://api.openai.com/v1') {
        options.apiBaseUrl = 'https://api.mistral.ai/v1'
      }
      // Otherwise use whatever custom URL the user provided
    }
    else if (process.env.FIREWORKS_API_KEY) {
      this.useFireworks = true
      this.fireworksApiKey = process.env.FIREWORKS_API_KEY
      this.fireworksModel = openaiOptions.model
      // Auto-set base URL only if using the default OpenAI URL
      if (options.apiBaseUrl === 'https://api.openai.com/v1') {
        options.apiBaseUrl = 'https://api.fireworks.ai/inference/v1'
      }
      // Otherwise use whatever custom URL the user provided
    } 
    else if (process.env.OPENAI_API_KEY) {
      const currentDate = new Date().toISOString().split('T')[0]
      const systemMessage = `${options.systemMessage} 
Knowledge cutoff: ${openaiOptions.tokenLimits.knowledgeCutOff}
Current date: ${currentDate}

IMPORTANT: Entire response must be in the language with ISO code: ${options.language}
`

      this.api = new ChatGPTAPI({
        apiBaseUrl: options.apiBaseUrl,
        systemMessage,
        apiKey: process.env.OPENAI_API_KEY,
        apiOrg: process.env.OPENAI_API_ORG ?? undefined,
        debug: options.debug,
        maxModelTokens: openaiOptions.tokenLimits.maxTokens,
        maxResponseTokens: openaiOptions.tokenLimits.responseTokens,
        completionParams: {
          temperature: options.openaiModelTemperature,
          model: openaiOptions.model
        }
      })
    } else {
      const err =
        "Unable to initialize the API, none of 'OPENAI_API_KEY', 'FIREWORKS_API_KEY', or 'MISTRAL_API_KEY' environment variables are available"
      throw new Error(err)
    }
  }

  chat = async (message: string, ids: Ids): Promise<[string, Ids]> => {
    let res: [string, Ids] = ['', {}]
    try {
      res = await this.chat_(message, ids)
      return res
    } catch (e: unknown) {
      if (e instanceof ChatGPTError) {
        warning(`Failed to chat: ${e}, backtrace: ${e.stack}`)
      }
      return res
    }
  }

  private readonly chat_ = async (
    message: string,
    ids: Ids
  ): Promise<[string, Ids]> => {
    // record timing
    const start = Date.now()
    if (!message) {
      return ['', {}]
    }

    let responseText = ''
    let newIds: Ids = {}

    if (this.useMistral) {
      try {
        const currentDate = new Date().toISOString().split('T')[0]
        const systemMessage = `${this.options.systemMessage} 
Current date: ${currentDate}

IMPORTANT: Entire response must be in the language with ISO code: ${this.options.language}
`

        const client = createMistral({
          apiKey: this.mistralApiKey,
          baseURL: this.options.apiBaseUrl
        })

        const result = await pRetry(async () => {
          const {text} = await generateText({
            model: client(this.mistralModel),
            system: systemMessage,
            prompt: message,
            temperature: this.options.openaiModelTemperature
          })
          return text
        }, {
          retries: this.options.openaiRetries
        })

        responseText = result
        newIds = {parentMessageId: `mistral_${Date.now()}`, conversationId: `mistral_${Date.now()}`}
        
        const end = Date.now()
        info(`Mistral API response time: ${end - start} ms`)
        
      } catch (e: unknown) {
        warning(`Failed to chat with Mistral: ${e}`)
        return ['', {}]
      }
    } else if (this.useFireworks) {
      try {
        const currentDate = new Date().toISOString().split('T')[0]
        const systemMessage = `${this.options.systemMessage} 
Current date: ${currentDate}

IMPORTANT: Entire response must be in the language with ISO code: ${this.options.language}
`

        const client = createOpenAI({
          apiKey: this.fireworksApiKey,
          baseURL: this.options.apiBaseUrl
        })

        const result = await pRetry(async () => {
          const {text} = await generateText({
            model: client(this.fireworksModel),
            system: systemMessage,
            prompt: message,
            temperature: this.options.openaiModelTemperature
          })
          return text
        }, {
          retries: this.options.openaiRetries
        })

        responseText = result
        newIds = {parentMessageId: `fw_${Date.now()}`, conversationId: `fw_${Date.now()}`}
        
        const end = Date.now()
        info(`Fireworks API response time: ${end - start} ms`)
        
      } catch (e: unknown) {
        warning(`Failed to chat with Fireworks: ${e}`)
        return ['', {}]
      }
    } else if (this.api != null) {
      let response: ChatMessage | undefined
      const opts: SendMessageOptions = {
        timeoutMs: this.options.openaiTimeoutMS
      }
      if (ids.parentMessageId) {
        opts.parentMessageId = ids.parentMessageId
      }
      try {
        response = await pRetry(() => this.api!.sendMessage(message, opts), {
          retries: this.options.openaiRetries
        })
      } catch (e: unknown) {
        if (e instanceof ChatGPTError) {
          info(
            `response: ${response}, failed to send message to openai: ${e}, backtrace: ${e.stack}`
          )
        }
      }
      const end = Date.now()
      info(`response: ${JSON.stringify(response)}`)
      info(
        `openai sendMessage (including retries) response time: ${
          end - start
        } ms`
      )
      
      if (response != null) {
        responseText = response.text
        newIds = {
          parentMessageId: response?.id,
          conversationId: response?.conversationId
        }
      } else {
        warning('openai response is null')
      }
    } else {
      setFailed('No API is initialized')
    }
    
    // remove the prefix "with " in the response
    if (responseText.startsWith('with ')) {
      responseText = responseText.substring(5)
    }
    if (this.options.debug) {
      info(`API responses: ${responseText}`)
    }
    
    return [responseText, newIds]
  }
}
