import { Injectable, Pipe, PipeTransform } from '@angular/core';

import { Observable } from 'rxjs/Observable';
import {AnonymousSubscription} from 'rxjs/Subscription';

import { Store } from '@ngrx/store';

import { NgrxJsonApiSelectors } from './selectors';
import {
  ApiCreateInitAction,
  ApiReadInitAction,
  ApiUpdateInitAction,
  ApiDeleteInitAction,
  DeleteFromStateAction,
  PostStoreResourceAction,
  PatchStoreResourceAction,
  DeleteStoreResourceAction,
  ApiCommitInitAction,
  RemoveQueryAction,
} from './actions';
import {
  NgrxJsonApiStore,
  ResourceQuery,
  Payload,
  QueryType,
  NgrxJsonApiStore,
  Resource,
  ResourceRelationship,
  ResourceIdentifier,
  ResourceStore,
  ResourceDefinition
} from './interfaces';

@Injectable()
export class NgrxJsonApiService<T> {

  constructor(
    private store: Store<T>,
    private selectors: NgrxJsonApiSelectors<T>) {}

  public select$(query: ResourceQuery) {
    return this.selectors.get$(query);
  }

  public create(payload: Payload) {
    this.store.dispatch(new ApiCreateInitAction(payload));
  }

  public read(payload: Payload) {
    this.store.dispatch(new ApiReadInitAction(payload));
  }

  public update(payload: Payload) {
    this.store.dispatch(new ApiUpdateInitAction(payload));
  }

  public delete(payload: Payload) {
    this.store.dispatch(new ApiDeleteInitAction(payload));
  }

  public deleteFromState(payload: Payload) {
    this.store.dispatch(new DeleteFromStateAction(payload));
  }
}


export interface ResourceQueryHandle<T> extends AnonymousSubscription {

  results : Observable<T>;

}


@Injectable()
export class NgrxJsonApiServiceV2 {

  private test: boolean = true;

  /**
   * Keeps current snapshot of the store to allow fast access to resources.
   */
  private storeSnapshot : NgrxJsonApiStore;

  constructor(
      private store: Store<any>,
      private selectors: NgrxJsonApiSelectors<any>,
      private apiUrl : string,
      private resourceDefinitions : Array<ResourceDefinition>,
  ) {

    this.store.select(selectors.storeLocation).subscribe(it => this.storeSnapshot = it as NgrxJsonApiStore);
  }

  public findOne(query: ResourceQuery) : ResourceQueryHandle<Resource> {
    query.queryType = "getOne";
    this.findInternal(query);

    return {
      results : this.selectResults(query.queryId).map(it => {
        if(it.length == 0){
          return null;
        }else if(it.length == 1){
          return it[0];
        }else{
          throw new Error("Unique result expected");
        }}
      ),
      unsubscribe : () => this.removeQuery(query.queryId)
    }
  }

  public findMany(query: ResourceQuery) : ResourceQueryHandle<Array<Resource>> {
    query.queryType = "getMany";
    this.findInternal(query);
    return {
      results : this.selectResults(query.queryId),
      unsubscribe : () => this.removeQuery(query.queryId)
    }
  }

  private removeQuery(queryId : string){
    this.store.dispatch(new RemoveQueryAction(queryId));
  }

  private findInternal(query: ResourceQuery){
    let payload : Payload = {
      query: query
    };
    this.store.dispatch(new ApiReadInitAction(payload));
  }

  /**
   * Gets the current state of the given resources. Consider the use of selectResource(...) to get an observable of the resource.
   *
   * @param identifier
   */
  public getResourceSnapshot(identifier : ResourceIdentifier){
    let snapshot = this.storeSnapshot;
    if( snapshot.data[identifier.type] && snapshot.data[identifier.type][identifier.id]){
        return snapshot.data[identifier.type][identifier.id].resource;
    }
    return null;
  }

  /**
   * Gets the current persisted state of the given resources. Consider the use of selectResource(...) to get an observable of the
   * resource.
   *
   * @param identifier
   */
  public getPersistedResourceSnapshot(identifier : ResourceIdentifier){
    let snapshot = this.storeSnapshot;
    if( snapshot.data[identifier.type] && snapshot.data[identifier.type][identifier.id]){
      return snapshot.data[identifier.type][identifier.id].persistedResource;
    }
    return null;
  }

  /**
   * Selects the results of the given query.
   *
   * @param queryId
   * @returns observable holding the results as array of resources.
   */
  public selectResults(queryId: string) : Observable<Array<Resource>> {
    return this.selectors.getResults$(this.store, queryId);
  }

  /**
   * Selects the result identifiers of the given query.
   *
   * @param queryId
   * @returns {any}
   */
  public selectResultIdentifiers(queryId: string) : Observable<Array<ResourceIdentifier>> {
    return this.selectors.getResultIdentifiers$(this.store, queryId);
  }

  /**
   * @param identifier of the resource
   * @returns observable of the resource
   */
  public selectResource(identifier: ResourceIdentifier) : Observable<Resource> {
    return this.selectors.getResource$(this.store, identifier);
  }

  /**
   * @param identifier of the resource
   * @returns observable of the resource
   */
  public selectResourceStore(identifier: ResourceIdentifier) : Observable<ResourceStore> {
    return this.selectors.getResourceStore$(this.store, identifier);
  }


  /**
   * Updates the given resource in the store with the provided data.
   * Use commit() to send the changes to the remote JSON API endpoint.
   *
   * @param resource
   */
  public patchResource(resource: Resource) {
    this.store.dispatch(new PatchStoreResourceAction(resource));
  }

  /**
   * Adds the given resource to the store. Any already existing
   * resource with the same id gets replaced. Use commit() to send
   * the changes to the remote JSON API endpoint.
   *
   * @param resource
   */
  public postResource(resource: Resource) {
    this.store.dispatch(new PostStoreResourceAction(resource));
  }

  /**
   * Marks the given resource for deletion.
   *
   * @param resourceId
   */
  public deleteResource(resourceId: ResourceIdentifier) {
    this.store.dispatch(new DeleteStoreResourceAction(resourceId));
  }

  /**
   * Applies all pending changes to the remote JSON API endpoint.
   */
  public commit() {
    let storeLocation = this.selectors.storeLocation;
    this.store.dispatch(new ApiCommitInitAction(storeLocation));
  }
}



@Pipe({name: 'jaGetResource'})
export class GetResourcePipe implements PipeTransform {

  constructor(private service : NgrxJsonApiServiceV2){
  }

  transform(id: ResourceIdentifier): Resource {
    return this.service.getResourceSnapshot(id);
  }
}

@Pipe({name: 'jaSelectResource'})
export class SelectResourcePipe implements PipeTransform {

  constructor(private service : NgrxJsonApiServiceV2){
  }

  transform(id: ResourceIdentifier): Observable<Resource> {
    return this.service.selectResource(id);
  }
}


@Pipe({name: 'jaSelectResourceStore'})
export class SelectResourceStorePipe implements PipeTransform {

  constructor(private service : NgrxJsonApiServiceV2){
  }

  transform(id: ResourceIdentifier): Observable<ResourceStore> {
    return this.service.selectResourceStore(id);
  }
}
