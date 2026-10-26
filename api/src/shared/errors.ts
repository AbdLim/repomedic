export class HttpError extends Error {
    constructor(
        public status: number,
        message: string,
    ) {
        super(message);
    }
}
export const messageOf = (error: unknown) =>
    error instanceof Error ? error.message : 'Unknown error';
