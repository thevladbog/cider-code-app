/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreatedProductId } from '../models/CreatedProductId';
import type { CreateProductDto } from '../models/CreateProductDto';
import type { IProductFindMany } from '../models/IProductFindMany';
import type { SelectProductDto } from '../models/SelectProductDto';
import type { UpdateProductDto } from '../models/UpdateProductDto';
import type { UpdateProductStatusDto } from '../models/UpdateProductStatusDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ProductService {
    /**
     * Create product
     * Create a new product with all required details
     * @returns CreatedProductId The record has been successfully created.
     * @throws ApiError
     */
    public static productControllerCreate({
        requestBody,
    }: {
        /**
         * Json structure for product object
         */
        requestBody: CreateProductDto,
    }): CancelablePromise<CreatedProductId> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/product',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                403: `Forbidden.`,
            },
        });
    }
    /**
     * Get all products
     * Retrieve a paginated list of all products with optional search capabilities
     * @returns IProductFindMany
     * @throws ApiError
     */
    public static productControllerFindAll({
        page,
        limit,
        search,
    }: {
        /**
         * Page number
         */
        page?: number,
        /**
         * Items per page
         */
        limit?: number,
        /**
         * Search string
         */
        search?: string,
    }): CancelablePromise<IProductFindMany> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/product',
            query: {
                'page': page,
                'limit': limit,
                'search': search,
            },
            errors: {
                403: `Forbidden.`,
            },
        });
    }
    /**
     * Get product by ID
     * Retrieve detailed information about a specific product by its ID
     * @returns SelectProductDto
     * @throws ApiError
     */
    public static productControllerFindOne({
        id,
    }: {
        id: string,
    }): CancelablePromise<SelectProductDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/product/{id}',
            path: {
                'id': id,
            },
            errors: {
                403: `Forbidden.`,
                404: `Product not found.`,
            },
        });
    }
    /**
     * Update product
     * Update an existing product information such as name, GTIN, alcohol code, etc.
     * @returns UpdateProductDto
     * @throws ApiError
     */
    public static productControllerUpdate({
        id,
        requestBody,
    }: {
        id: string,
        /**
         * Json structure for product object
         */
        requestBody: UpdateProductDto,
    }): CancelablePromise<UpdateProductDto> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/product/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                403: `Forbidden.`,
                404: `Product not found.`,
            },
        });
    }
    /**
     * Delete product
     * Remove a product from the system
     * @returns any Product successfully deleted
     * @throws ApiError
     */
    public static productControllerRemove({
        id,
    }: {
        id: string,
    }): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/product/{id}',
            path: {
                'id': id,
            },
            errors: {
                403: `Forbidden.`,
                404: `Product not found.`,
            },
        });
    }
    /**
     * Update product status
     * Change product status (ACTIVE, INACTIVE, PAUSED, etc.)
     * @returns UpdateProductDto Product status successfully updated
     * @throws ApiError
     */
    public static productControllerUpdateStatus({
        id,
        requestBody,
    }: {
        id: string,
        /**
         * Json structure for product status
         */
        requestBody: UpdateProductStatusDto,
    }): CancelablePromise<UpdateProductDto> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/product/{id}/status',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                403: `Forbidden.`,
                404: `Product not found.`,
            },
        });
    }
    /**
     * Search products
     * Search for products by name, GTIN, alcohol code or other attributes
     * @returns SelectProductDto
     * @throws ApiError
     */
    public static productControllerSearch({
        search,
    }: {
        search: string,
    }): CancelablePromise<Array<SelectProductDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/product/search',
            query: {
                'search': search,
            },
            errors: {
                403: `Forbidden.`,
            },
        });
    }
}
