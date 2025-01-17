import * as fetchType from 'undici/types/fetch'
import { ChatLunaError, ChatLunaErrorCode } from './error'

export async function sse(
    response: fetchType.Response | ReadableStreamDefaultReader<string>,
    onEvent: (
        rawData: string
    ) => Promise<string | boolean | void> = async () => {},
    cacheCount: number = 0
) {
    if (!(response instanceof ReadableStreamDefaultReader || response.ok)) {
        const error = await response.json().catch(() => ({}))

        throw new ChatLunaError(
            ChatLunaErrorCode.NETWORK_ERROR,
            new Error(
                `${response.status} ${response.statusText} ${JSON.stringify(
                    error
                )}`
            )
        )
    }

    const reader =
        response instanceof ReadableStreamDefaultReader
            ? response
            : response.body.getReader()

    const decoder = new TextDecoder('utf-8')

    let bufferString = ''

    let tempCount = 0

    try {
        while (true) {
            const { value, done } = await reader.read()

            if (done) {
                if (bufferString.length > 0) {
                    await onEvent(bufferString)
                }
                break
            }

            const decodeValue = decoder.decode(value, { stream: true })

            bufferString += decodeValue
            tempCount++

            if (tempCount > cacheCount) {
                await onEvent(bufferString)

                bufferString = ''
                tempCount = 0
            }
        }
    } finally {
        reader.releaseLock()
    }
}

// eslint-disable-next-line generator-star-spacing
export async function* sseIterable(
    response: fetchType.Response | ReadableStreamDefaultReader<string>,
    checkedFunction?: (
        data: string,
        event?: string,
        kvMap?: Record<string, string>
    ) => boolean,
    mappedFunction?: (data: string) => string | Error,
    cacheCount: number = 0
) {
    if (!(response instanceof ReadableStreamDefaultReader) && !response.ok) {
        const error = await response.json().catch(() => ({}))

        throw new ChatLunaError(
            ChatLunaErrorCode.NETWORK_ERROR,
            new Error(
                `${response.status} ${response.statusText} ${JSON.stringify(
                    error
                )}`
            )
        )
    }

    const reader =
        response instanceof ReadableStreamDefaultReader
            ? response
            : response.body.getReader()

    const decoder = new TextDecoder('utf-8')

    let bufferString = ''

    let tempCount = 0

    try {
        while (true) {
            const { value, done } = await reader.read()

            const decodeValue = decoder.decode(value, { stream: true })

            if (mappedFunction) {
                const mappedValue = mappedFunction(decodeValue)

                if (mappedValue instanceof Error) {
                    throw mappedValue
                }
            }

            bufferString += decodeValue
            tempCount++

            if (tempCount < cacheCount) {
                continue
            }

            if (bufferString.trim().length === 0) {
                continue
            }

            const splitted = bufferString
                .split('\n\n')
                .flatMap((item) => item.split('\n'))

            let currentTemp: Record<string, string> = {}

            for (let i = 0; i < splitted.length; i++) {
                const item = splitted[i]

                if (item.trim().length === 0) {
                    continue
                }

                // data: {aa:xx}
                // event:finish

                const [, type, data] = /(\w+):\s*(.*)$/g.exec(item) ?? [
                    '',
                    '',
                    ''
                ]

                currentTemp[type] = data

                if (type !== 'data') {
                    continue
                }

                if (checkedFunction) {
                    const result = checkedFunction(
                        data,
                        currentTemp?.['event'],
                        currentTemp
                    )

                    if (result) {
                        yield data
                    }

                    currentTemp = {}
                    continue
                }

                currentTemp = {}

                yield data
            }

            bufferString = ''
            tempCount = 0

            if (done) {
                return '[DONE]'
            }
        }
    } finally {
        reader.releaseLock()
    }
}
