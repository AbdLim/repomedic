import 'express';

declare module 'express-serve-static-core' {
    interface Request {
        user?: {
            id: string;
            email: string;
            jti?: string;
        };
        token?: string;
    }
}

declare module 'express' {
    interface Request {
        user?: {
            id: string;
            email: string;
            jti?: string;
        };
        token?: string;
    }
}
