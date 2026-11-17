import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const res = ctx.getResponse<Response>();
        const req = ctx.getRequest<Request>();

        let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
        let message: string | string[] = 'Internal server error';

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const body = exception.getResponse();
            message =
                typeof body === 'string'
                    ? body
                    : ((body as { message?: string | string[] }).message ?? exception.message);
        } else if (exception instanceof QueryFailedError) {
            const code = exception.driverError?.code as string | undefined;
            if (code === '23505') {
                status = HttpStatus.CONFLICT;
                message = 'A record with this value already exists';
            } else if (code === '23503') {
                status = HttpStatus.BAD_REQUEST;
                message = 'Related record does not exist';
            } else {
                this.logger.error(exception.message);
            }
        } else {
            this.logger.error(exception instanceof Error ? exception.stack : String(exception));
        }

        res.status(status).json({
            success: false,
            statusCode: status,
            message,
            path: req.originalUrl,
            timestamp: new Date().toISOString(),
        });
    }
}