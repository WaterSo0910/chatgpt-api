import axios from 'axios'
import dotenv from 'dotenv'
import { v4 as uuidv4 } from 'uuid'

import * as types from './types'

dotenv.config()

export async function sendMessage(
  text: string,
  opts: types.SendMessageBrowserOptions = {}
): Promise<types.ChatMessage> {
  const accessToken = process.env.OPENAI_ACCESS_TOKEN
  const apiReverseProxyUrl = 'https://api.pawan.krd/backend-api/conversation'
  const model = 'text-davinci-002-render-sha'
  const debug = false
  const {
    conversationId,
    parentMessageId = uuidv4(),
    messageId = uuidv4(),
    action = 'next',
    timeoutMs,
    onProgress
  } = opts

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'text/event-stream',
    'Content-Type': 'application/json'
  }
  const body: types.ConversationJSONBody = {
    action,
    messages: [
      {
        id: messageId,
        role: 'user',
        content: {
          content_type: 'text',
          parts: [text]
        }
      }
    ],
    model: model,
    parent_message_id: parentMessageId
  }
  if (conversationId) {
    body.conversation_id = conversationId
  }
  const responseP = new Promise<types.ChatMessage>(async (resolve, reject) => {
    const result: types.ChatMessage = {
      role: 'assistant',
      id: uuidv4(),
      parentMessageId: messageId,
      conversationId,
      text: ''
    }
    try {
      const response = await axios.post(apiReverseProxyUrl, body, {
        headers: headers,
        responseType: 'stream'
      })
      const stream = response.data

      stream.on('data', async (buf: Buffer) => {
        // Process data
        const dataList = buf.toString().split('\n\n')

        dataList.forEach((data) => {
          try {
            if (data.substring(0, 6) !== 'data: ') {
              throw Error('Not complete. Keep appending..')
            }
            console.log(data.substring(0, 6))
            data = data.substring(6)
            if (data === '[DONE]') {
              resolve(result)
              return
            }
            const convoResponseEvent: types.ConversationResponseEvent =
              JSON.parse(data)
            if (convoResponseEvent.message?.id) {
              result.id = convoResponseEvent.message.id
            }
            const message = convoResponseEvent.message
            if (message) {
              let text = message?.content?.parts?.[0]

              if (text) {
                result.text = text
                if (onProgress) {
                  onProgress(result)
                }
              }
            }
          } catch (err) {
            dataList[0] += data
          }
        })
      })
    } catch (err) {
      reject(err)
    }
  })
  return responseP
}
sendMessage('Hello, who are u?', {
  onProgress: (partialResponse) => {
    console.log('onProgress', partialResponse.text)
  }
})
  .then((response) => {
    console.log('response', response)
  })
  .catch((err) => {
    console.error(err)
  })
