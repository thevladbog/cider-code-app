/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreatedOrderToDeliveryId } from '../models/CreatedOrderToDeliveryId';
import type { CreateOrderToDeliveryDto } from '../models/CreateOrderToDeliveryDto';
import type { IOrderToDeliveryFindMany } from '../models/IOrderToDeliveryFindMany';
import type { SelectOrderToDeliveryDto } from '../models/SelectOrderToDeliveryDto';
import type { UpdateOrderToDeliveryDto } from '../models/UpdateOrderToDeliveryDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class SabyOrdersService {
    /**
     * Create delivery order
     * Creates a new delivery order in the SABY system
     * @returns CreatedOrderToDeliveryId The record has been successfully created.
     * @throws ApiError
     */
    public static sabyControllerCreate({
        requestBody,
    }: {
        /**
         * Json structure for order object
         */
        requestBody: CreateOrderToDeliveryDto,
    }): CancelablePromise<CreatedOrderToDeliveryId> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/saby/order/delivery',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                403: `Forbidden.`,
            },
        });
    }
    /**
     * Get all delivery orders
     * Retrieves a paginated list of delivery orders from the SABY system with optional filtering
     * @returns IOrderToDeliveryFindMany
     * @throws ApiError
     */
    public static sabyControllerFindAll({
        page,
        limit,
        status,
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
         * Order status filter
         */
        status?: 'NEW' | 'ARCHIVE',
        /**
         * Search string
         */
        search?: string,
    }): CancelablePromise<IOrderToDeliveryFindMany> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/saby/order/delivery',
            query: {
                'page': page,
                'limit': limit,
                'status': status,
                'search': search,
            },
            errors: {
                403: `Forbidden.`,
            },
        });
    }
    /**
     * Get delivery order by ID
     * Retrieves a specific delivery order from the SABY system by its ID
     * @returns SelectOrderToDeliveryDto
     * @throws ApiError
     */
    public static sabyControllerFindOne({
        id,
    }: {
        id: string,
    }): CancelablePromise<SelectOrderToDeliveryDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/saby/order/delivery/{id}',
            path: {
                'id': id,
            },
            errors: {
                403: `Forbidden.`,
                404: `Order not found.`,
            },
        });
    }
    /**
     * Update delivery order
     * Updates an existing delivery order in the SABY system by its ID
     * @returns UpdateOrderToDeliveryDto
     * @throws ApiError
     */
    public static sabyControllerUpdate({
        id,
        requestBody,
    }: {
        id: string,
        /**
         * Json structure for order object
         */
        requestBody: UpdateOrderToDeliveryDto,
    }): CancelablePromise<UpdateOrderToDeliveryDto> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/saby/order/delivery/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                403: `Forbidden.`,
                404: `Order not found.`,
            },
        });
    }
    /**
     * Update delivery order from SABY
     * Updates a delivery order with information received from the SABY system
     * @returns UpdateOrderToDeliveryDto
     * @throws ApiError
     */
    public static sabyControllerUpdateFromSaby({
        requestBody,
    }: {
        /**
         * Json structure for order object
         */
        requestBody: UpdateOrderToDeliveryDto,
    }): CancelablePromise<UpdateOrderToDeliveryDto> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/saby/order/delivery/change',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                403: `Forbidden.`,
                404: `Order not found.`,
            },
        });
    }
}
