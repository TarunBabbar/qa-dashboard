declare module "openai" {
  export class OpenAI {
    constructor(config: { apiKey: string });
    chat: {
      completions: {
        create(params: {
          model: string;
          messages: Array<{ role: string; content: string }>;
          stream?: boolean;
        }): AsyncIterable<{ choices: Array<{ delta: { content?: string } }> }>;
      };
    };
  }
  export default OpenAI;
}