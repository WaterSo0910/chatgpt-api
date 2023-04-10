import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'

import * as types from './types'

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
  const result: types.ChatMessage = {
    role: 'assistant',
    id: uuidv4(),
    parentMessageId: messageId,
    conversationId,
    text: ''
  }

  const axiosInstance = axios.create({
    baseURL: apiReverseProxyUrl
  })
  const responseP = new Promise<types.ChatMessage>(async (resolve, reject) => {
    const res = await axiosInstance.post<string>('/', body, { headers })
    const data = res.data

    if (res.data === '[DONE]') {
      return resolve(result)
    }
    try {
      console.log(data)
      const convoResponseEvent: types.ConversationResponseEvent =
        JSON.parse(data)
      console.log(convoResponseEvent)
      if (convoResponseEvent.conversation_id) {
        result.conversationId = convoResponseEvent.conversation_id
      }
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
      reject(err)
    }
  })
  return responseP
}
sendMessage('Hello, who are u?', {
  onProgress: (partialResponse) => {
    console.log(partialResponse.text)
  }
})
  .then((response) => {
    console.log('Chat start!!')
    console.log(response)
    console.log('Nice chating!!')
  })
  .catch((err) => {
    console.error(err)
  })
