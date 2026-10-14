const encoder = new TextEncoder();

export function encodeEvent(event: string, payload: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

export type SSEMessage = { event: string; data: unknown };

/**
 * Incremental SSE parser: feed decoded text chunks, get complete messages.
 * Partial messages stay buffered until their blank-line terminator arrives.
 */
export function createSSEParser() {
  let buffer = "";
  return (chunk: string): SSEMessage[] => {
    buffer += chunk.replace(/\r\n/g, "\n");
    const messages: SSEMessage[] = [];
    let end = buffer.indexOf("\n\n");
    while (end !== -1) {
      const raw = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      let event = "message";
      const data: string[] = [];
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
      }
      if (data.length) {
        try {
          messages.push({ event, data: JSON.parse(data.join("\n")) });
        } catch {
          // Ignore malformed frames.
        }
      }
      end = buffer.indexOf("\n\n");
    }
    return messages;
  };
}
