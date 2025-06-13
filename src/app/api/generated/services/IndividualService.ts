/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { IndividualCodeDataDto } from '../models/IndividualCodeDataDto';
import type { WriteIndividualCodeDto } from '../models/WriteIndividualCodeDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class IndividualService {
    /**
     * Create individual code
     * Create a new individual product code and store it in the database with product association
     * @returns IndividualCodeDataDto Code successfully created and stored in database
     * @throws ApiError
     */
    public static codeControllerWriteIndividualCode({
        requestBody,
    }: {
        requestBody: WriteIndividualCodeDto,
    }): CancelablePromise<IndividualCodeDataDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/code/individual',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid input format or validation error`,
            },
        });
    }
}
