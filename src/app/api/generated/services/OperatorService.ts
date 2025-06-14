/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */

import type { CreatedOperatorDto } from '../models/CreatedOperatorDto';
import type { CreateOperatorDto } from '../models/CreateOperatorDto';
import type { IOperatorFindMany } from '../models/IOperatorFindMany';
import type { IOperatorFindOne } from '../models/IOperatorFindOne';
import type { IShiftFindMany } from '../models/IShiftFindMany';
import type { IShiftFindOne } from '../models/IShiftFindOne';
import type { LoginOperatorDto } from '../models/LoginOperatorDto';
import type { OperatorLoginResponse } from '../models/OperatorLoginResponse';
import type { UpdateOperatorDto } from '../models/UpdateOperatorDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class OperatorService {
  /**
   * Create operator
   * Create a new operator account in the system
   * @returns CreatedOperatorDto User successfully created
   * @throws ApiError
   */
  public static operatorControllerCreateOperator({
    requestBody,
  }: {
    requestBody: CreateOperatorDto;
  }): CancelablePromise<CreatedOperatorDto> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/operator',
      body: requestBody,
      mediaType: 'application/json',
    });
  }
  /**
   * Get all operators
   * Retrieve a paginated list of all operators in the system
   * @returns IOperatorFindMany Returns a list of operators
   * @throws ApiError
   */
  public static operatorControllerFindAll({
    page,
    limit,
  }: {
    /**
     * Page number
     */
    page?: number;
    /**
     * Items per page
     */
    limit?: number;
  }): CancelablePromise<IOperatorFindMany> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/operator',
      query: {
        page: page,
        limit: limit,
      },
    });
  }
  /**
   * Update operator
   * Update operator information such as name or barcode
   * @returns IOperatorFindOne
   * @throws ApiError
   */
  public static operatorControllerUpdateOperator({
    id,
    requestBody,
  }: {
    id: string;
    requestBody: UpdateOperatorDto;
  }): CancelablePromise<IOperatorFindOne> {
    return __request(OpenAPI, {
      method: 'PATCH',
      url: '/operator/{id}',
      path: {
        id: id,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        404: `Operator not found`,
      },
    });
  }
  /**
   * Login operator
   * Authenticate an operator using barcode and return JWT token
   * @returns OperatorLoginResponse Operator login successful
   * @throws ApiError
   */
  public static operatorControllerLogin({
    requestBody,
  }: {
    requestBody: LoginOperatorDto;
  }): CancelablePromise<OperatorLoginResponse> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/operator/login',
      body: requestBody,
      mediaType: 'application/json',
    });
  }
  /**
   * Get operator by ID
   * Retrieve detailed information about a specific operator
   * @returns IOperatorFindOne Returns the requested operator
   * @throws ApiError
   */
  public static operatorControllerFindOne({
    id,
  }: {
    id: string;
  }): CancelablePromise<IOperatorFindOne> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/operator/one/{id}',
      path: {
        id: id,
      },
      errors: {
        404: `Operator can't be found or something went wrong`,
      },
    });
  }
  /**
   * Get current operator
   * Get details of the currently authenticated operator
   * @returns IOperatorFindOne Returns current operator information
   * @throws ApiError
   */
  public static operatorControllerGetMe(): CancelablePromise<IOperatorFindOne> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/operator/me',
      errors: {
        401: `Unauthorized or operator token missing`,
      },
    });
  }
  /**
   * Get all shifts for operator
   * Retrieve a paginated list of all production shifts accessible by operators
   * @returns IShiftFindMany Returns a list of shifts
   * @throws ApiError
   */
  public static shiftControllerFindAllForApp({
    page,
    limit,
  }: {
    /**
     * Page number
     */
    page?: number;
    /**
     * Items per page
     */
    limit?: number;
  }): CancelablePromise<IShiftFindMany> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/shift/operator',
      query: {
        page: page,
        limit: limit,
      },
    });
  }
  /**
   * Get shift by ID for operator
   * Retrieve detailed information about a specific production shift for operators
   * @returns IShiftFindOne Returns the requested shift
   * @throws ApiError
   */
  public static shiftControllerFindOneForApp({
    id,
  }: {
    id: string;
  }): CancelablePromise<IShiftFindOne> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/shift/operator/{id}',
      path: {
        id: id,
      },
      errors: {
        404: `Shift can't be found or something went wrong`,
      },
    });
  }
}
