/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class DownloadService {
    /**
     * Download codes as text file
     * Download codes for a specific shift as a text file. Can include box codes if requested.
     * @returns string Text file with codes successfully generated
     * @throws ApiError
     */
    public static codeControllerDownloadCodes({
        shiftId,
        includeBoxes,
    }: {
        /**
         * ID of the shift to download codes for
         */
        shiftId: string,
        /**
         * Whether to include box codes in the download
         */
        includeBoxes?: boolean,
    }): CancelablePromise<string> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/code/download',
            query: {
                'includeBoxes': includeBoxes,
                'shiftId': shiftId,
            },
            errors: {
                400: `Invalid input data format`,
                404: `Shift not found`,
            },
        });
    }
}
