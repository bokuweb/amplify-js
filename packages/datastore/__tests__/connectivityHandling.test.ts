import { Observable } from 'zen-observable-ts';
import { parse } from 'graphql';
import {
	pause,
	getDataStore,
	waitForEmptyOutbox,
	waitForDataStoreReady,
} from './helpers';
import { Predicates } from '../src/predicates';
import { syncExpression } from '../src/types';

/**
 * Surfaces errors sooner and outputs them more clearly if/when
 * a test begins to fail.
 */
async function waitForEmptyOutboxOrError(service) {
	const pendingError = new Promise((resolve, reject) => {
		service.log = (channel, message) => {
			if (channel.includes('API Response')) {
				if (message.errors?.length > 0) reject(message);
			}
		};
	});

	return await Promise.race([waitForEmptyOutbox(), pendingError]);
}

describe('DataStore sync engine', () => {
	// establish types :)
	let {
		DataStore,
		schema,
		connectivityMonitor,
		Model,
		ModelWithExplicitOwner,
		ModelWithExplicitCustomOwner,
		ModelWithMultipleCustomOwner,
		BasicModel,
		BasicModelWritableTS,
		LegacyJSONPost,
		Post,
		Comment,
		HasOneParent,
		HasOneChild,
		CompositePKParent,
		CompositePKChild,
		graphqlService,
		simulateConnect,
		simulateDisconnect,
	} = getDataStore({ online: true, isNode: false });

	beforeEach(async () => {
		// we don't need to see all the console warnings for these tests ...
		(console as any)._warn = console.warn;
		console.warn = () => {};

		({
			DataStore,
			schema,
			connectivityMonitor,
			Model,
			ModelWithExplicitOwner,
			ModelWithExplicitCustomOwner,
			ModelWithMultipleCustomOwner,
			BasicModel,
			BasicModelWritableTS,
			LegacyJSONPost,
			Post,
			Comment,
			Model,
			HasOneParent,
			HasOneChild,
			CompositePKParent,
			CompositePKChild,
			graphqlService,
			simulateConnect,
			simulateDisconnect,
		} = getDataStore({ online: true, isNode: false }));
		await DataStore.start();
	});

	afterEach(async () => {
		await DataStore.clear();
		console.warn = (console as any)._warn;
	});

	describe('basic protocol', () => {
		test('sends model create to the cloud', async () => {
			const post = await DataStore.save(new Post({ title: 'post title' }));

			// give thread control back to subscription event handlers.
			await waitForEmptyOutbox();

			const table = graphqlService.tables.get('Post')!;
			expect(table.size).toEqual(1);

			const savedItem = table.get(JSON.stringify([post.id])) as any;
			expect(savedItem.title).toEqual(post.title);
		});

		test('omits readonly fields from mutation events on create', async () => {
			// make sure our test model still meets requirements to make this test valid.
			expect(schema.models.BasicModel.fields.createdAt.isReadOnly).toBe(true);

			const m = await DataStore.save(
				new BasicModel({
					body: 'whatever and ever',
				})
			);

			await waitForEmptyOutbox();

			const table = graphqlService.tables.get('BasicModel')!;
			expect(table.size).toEqual(1);

			const savedItem = table.get(JSON.stringify([m.id])) as any;
			expect(savedItem.body).toEqual(m.body);
		});

		test('omits null owner fields from mutation events on create', async () => {
			const m = await DataStore.save(
				new ModelWithExplicitOwner({
					title: 'very clever title',
					owner: null,
				})
			);

			await waitForEmptyOutboxOrError(graphqlService);

			const table = graphqlService.tables.get('ModelWithExplicitOwner')!;
			expect(table.size).toEqual(1);

			const savedItem = table.get(JSON.stringify([m.id])) as any;
			expect(savedItem.title).toEqual(m.title);
		});

		test('omits undefined owner fields from mutation events on create', async () => {
			const m = await DataStore.save(
				new ModelWithExplicitOwner({
					title: 'very clever title',
					owner: undefined,
				})
			);

			await waitForEmptyOutboxOrError(graphqlService);

			const table = graphqlService.tables.get('ModelWithExplicitOwner')!;
			expect(table.size).toEqual(1);

			const savedItem = table.get(JSON.stringify([m.id])) as any;
			expect(savedItem.title).toEqual(m.title);
		});

		test('omits null custom owner fields from mutation events on create', async () => {
			const m = await DataStore.save(
				new ModelWithExplicitCustomOwner({
					title: 'very clever title',
					customowner: null,
				})
			);

			await waitForEmptyOutboxOrError(graphqlService);

			const table = graphqlService.tables.get('ModelWithExplicitCustomOwner')!;
			expect(table.size).toEqual(1);

			const savedItem = table.get(JSON.stringify([m.id])) as any;
			expect(savedItem.title).toEqual(m.title);
		});

		test('omits undefined custom owner fields from mutation events on create', async () => {
			const m = await DataStore.save(
				new ModelWithExplicitCustomOwner({
					title: 'very clever title',
					customowner: undefined,
				})
			);

			await waitForEmptyOutboxOrError(graphqlService);

			const table = graphqlService.tables.get('ModelWithExplicitCustomOwner')!;
			expect(table.size).toEqual(1);

			const savedItem = table.get(JSON.stringify([m.id])) as any;
			expect(savedItem.title).toEqual(m.title);
		});

		test('omits empty owner fields (multi, both empty) from mutation events on create', async () => {
			const m = await DataStore.save(
				new ModelWithMultipleCustomOwner({
					title: 'very clever title',
					customownerOne: undefined,
					customownerTwo: undefined,
				})
			);

			await waitForEmptyOutboxOrError(graphqlService);

			const table = graphqlService.tables.get('ModelWithMultipleCustomOwner')!;
			expect(table.size).toEqual(1);

			const savedItem = table.get(JSON.stringify([m.id])) as any;
			expect(savedItem.title).toEqual(m.title);
		});

		test('omits empty owner fields (multi, owner 1 empty) from mutation events on create', async () => {
			const m = await DataStore.save(
				new ModelWithMultipleCustomOwner({
					title: 'very clever title',
					customownerOne: undefined,
					customownerTwo: 'bob',
				})
			);

			await waitForEmptyOutboxOrError(graphqlService);

			const table = graphqlService.tables.get('ModelWithMultipleCustomOwner')!;
			expect(table.size).toEqual(1);

			const savedItem = table.get(JSON.stringify([m.id])) as any;
			expect(savedItem.title).toEqual(m.title);
		});

		test('omits null custom owner fields (multi, owner 2 empty) from mutation events on create', async () => {
			const m = await DataStore.save(
				new ModelWithMultipleCustomOwner({
					title: 'very clever title',
					customownerOne: 'bob',
					customownerTwo: undefined,
				})
			);

			await waitForEmptyOutboxOrError(graphqlService);

			const table = graphqlService.tables.get('ModelWithMultipleCustomOwner')!;
			expect(table.size).toEqual(1);

			const savedItem = table.get(JSON.stringify([m.id])) as any;
			expect(savedItem.title).toEqual(m.title);
		});

		test('includes timestamp fields in mutation events when NOT readonly', async () => {
			// make sure our test model still meets requirements to make this test valid.
			expect(
				schema.models.BasicModelWritableTS.fields.createdAt.isReadOnly
			).toBe(false);

			const m = await DataStore.save(
				new BasicModelWritableTS({
					body: 'whatever else',
				})
			);

			await waitForEmptyOutbox();

			const table = graphqlService.tables.get('BasicModelWritableTS')!;
			expect(table.size).toEqual(1);

			const savedItem = table.get(JSON.stringify([m.id])) as any;
			expect(savedItem.body).toEqual(m.body);
		});

		test('uses model create subscription event to populate sync protocol metadata', async () => {
			const post = await DataStore.save(new Post({ title: 'post title' }));
			await waitForEmptyOutbox();

			const retrieved = (await DataStore.query(Post, post.id)) as any;

			expect(retrieved._version).toBe(1);
			expect(retrieved._deleted).toBe(false);
			expect(retrieved._lastChangedAt).toBeGreaterThan(0);
		});

		test('sends model update to the cloud', async () => {
			const post = await DataStore.save(new Post({ title: 'post title' }));
			await waitForEmptyOutbox();

			const retrieved = await DataStore.query(Post, post.id);

			const updated = await DataStore.save(
				Post.copyOf(retrieved!, draft => {
					draft.title = 'updated title';
				})
			);
			await waitForEmptyOutbox();

			const table = graphqlService.tables.get('Post')!;
			expect(table.size).toEqual(1);

			const savedItem = table.get(JSON.stringify([post.id])) as any;
			expect(savedItem.title).toEqual(updated.title);
		});

		test('send model updates where field is nullified to the cloud', async () => {
			const original = await DataStore.save(
				new Model({
					field1: 'field 1 value',
					dateCreated: new Date().toISOString(),
					optionalField1: 'optional field value',
				})
			);
			await waitForEmptyOutbox();

			const updated = await DataStore.save(
				Model.copyOf(
					(await DataStore.query(Model, original.id))!,
					m => (m.optionalField1 = undefined)
				)
			);
			const retrievedBeforeMutate = await DataStore.query(Model, original.id);
			await waitForEmptyOutbox();

			const table = graphqlService.tables.get('Model');
			const cloudItem = table?.get(JSON.stringify([original.id])) as any;
			const retrievedAfterMutate = await DataStore.query(Model, original.id);

			expect(updated.optionalField1).toBe(null);
			expect(cloudItem.optionalField1).toBe(null);
			expect(retrievedBeforeMutate?.optionalField1).toBe(null);
			expect(retrievedAfterMutate?.optionalField1).toBe(null);
		});

		test('sends model deletes to the cloud', async () => {
			const post = await DataStore.save(new Post({ title: 'post title' }));
			await waitForEmptyOutbox();

			const retrieved = await DataStore.query(Post, post.id);
			const deleted = await DataStore.delete(retrieved!);
			await waitForEmptyOutbox();

			const table = graphqlService.tables.get('Post')!;
			expect(table.size).toEqual(1);

			const savedItem = table.get(JSON.stringify([post.id])) as any;
			expect(savedItem.title).toEqual(deleted.title);
			expect(savedItem._deleted).toEqual(true);
		});

		test('sends conditional model deletes to the cloud with valid conditions', async () => {
			const post = await DataStore.save(new Post({ title: 'post title' }));
			await waitForEmptyOutbox();

			const retrieved = await DataStore.query(Post, post.id);

			const deleted = await DataStore.delete(retrieved!, p =>
				p.title.eq('post title')
			);
			await waitForEmptyOutbox();

			const table = graphqlService.tables.get('Post')!;
			expect(table.size).toEqual(1);

			const savedItem = table.get(JSON.stringify([post.id])) as any;
			expect(savedItem.title).toEqual(deleted.title);
			expect(savedItem._deleted).toEqual(true);
		});

		[null, undefined].forEach(value => {
			test(`model field can be set to ${value} to remove connection hasOne parent`, async () => {
				const child = await DataStore.save(
					new HasOneChild({ content: 'child content' })
				);
				const parent = await DataStore.save(
					new HasOneParent({
						child,
					})
				);
				await waitForEmptyOutboxOrError(graphqlService);
				const parentTable = graphqlService.tables.get('HasOneParent')!;
				const savedParentWithChild = parentTable.get(
					JSON.stringify([parent.id])
				) as any;
				expect(savedParentWithChild.hasOneParentChildId).toEqual(child.id);

				const parentWithoutChild = HasOneParent.copyOf(
					(await DataStore.query(HasOneParent, parent.id))!,
					draft => {
						draft.child = value;
					}
				);
				await DataStore.save(parentWithoutChild);

				await waitForEmptyOutboxOrError(graphqlService);

				const savedParentWithoutChild = parentTable.get(
					JSON.stringify([parent.id])
				) as any;
				expect(savedParentWithoutChild.hasOneParentChildId).toEqual(null);
			});

			test(`model field can be set to ${value} to remove connection on child hasMany`, async () => {
				const parent = await DataStore.save(
					new CompositePKParent({
						customId: 'customId',
						content: 'content',
					})
				);

				const child = await DataStore.save(
					new CompositePKChild({
						childId: 'childId',
						content: 'content',
						parent,
					})
				);

				await waitForEmptyOutboxOrError(graphqlService);
				const childTable = graphqlService.tables.get('CompositePKChild')!;
				const savedChildWithParent = childTable.get(
					JSON.stringify([child.childId, child.content])
				) as any;
				expect(savedChildWithParent.parentId).toEqual(parent.customId);
				expect(savedChildWithParent.parentTitle).toEqual(parent.content);

				const childWithoutParent = CompositePKChild.copyOf(
					(await DataStore.query(CompositePKChild, {
						childId: child.childId,
						content: child.content,
					}))!,
					draft => {
						draft.parent = value;
					}
				);
				await DataStore.save(childWithoutParent);

				await waitForEmptyOutboxOrError(graphqlService);

				const savedChildWithoutParent = childTable.get(
					JSON.stringify([child.childId, child.content])
				) as any;
				expect(savedChildWithoutParent.parentId).toEqual(null);
				expect(savedChildWithoutParent.parentTitle).toEqual(null);
			});
		});
	});

	describe('connection state change handling', () => {
		test('survives online -> offline -> online cycle', async () => {
			const post = await DataStore.save(
				new Post({
					title: 'a title',
				})
			);

			await waitForEmptyOutbox();
			await simulateDisconnect();
			await simulateConnect();
			await pause(1);

			const anotherPost = await DataStore.save(
				new Post({
					title: 'another title',
				})
			);

			await waitForEmptyOutbox();

			const table = graphqlService.tables.get('Post')!;
			expect(table.size).toEqual(2);

			const cloudPost = table.get(JSON.stringify([post.id])) as any;
			expect(cloudPost.title).toEqual('a title');

			const cloudAnotherPost = table.get(
				JSON.stringify([anotherPost.id])
			) as any;
			expect(cloudAnotherPost.title).toEqual('another title');
		});

		test('survives online -> offline -> save -> online cycle (non-racing)', async () => {
			const post = await DataStore.save(
				new Post({
					title: 'a title',
				})
			);

			await waitForEmptyOutbox();
			await simulateDisconnect();

			const outboxEmpty = waitForEmptyOutbox();
			const anotherPost = await DataStore.save(
				new Post({
					title: 'another title',
				})
			);

			// In this scenario, we want to test the case where the offline
			// save is NOT in a race with reconnection. So, we pause *briefly*.
			await pause(1);

			await simulateConnect();
			await outboxEmpty;

			const table = graphqlService.tables.get('Post')!;
			expect(table.size).toEqual(2);

			const cloudPost = table.get(JSON.stringify([post.id])) as any;
			expect(cloudPost.title).toEqual('a title');

			const cloudAnotherPost = table.get(
				JSON.stringify([anotherPost.id])
			) as any;
			expect(cloudAnotherPost.title).toEqual('another title');
		});

		test('survives online -> offline -> save/online race', async () => {
			const post = await DataStore.save(
				new Post({
					title: 'a title',
				})
			);

			await waitForEmptyOutbox();
			await simulateDisconnect();

			const outboxEmpty = waitForEmptyOutbox();

			const anotherPost = await DataStore.save(
				new Post({
					title: 'another title',
				})
			);

			// NO PAUSE: Simulate reconnect IMMEDIATELY, causing a race
			// between the save and the sync engine reconnection operations.

			await simulateConnect();
			await outboxEmpty;

			const table = graphqlService.tables.get('Post')!;
			expect(table.size).toEqual(2);

			const cloudPost = table.get(JSON.stringify([post.id])) as any;
			expect(cloudPost.title).toEqual('a title');

			const cloudAnotherPost = table.get(
				JSON.stringify([anotherPost.id])
			) as any;
			expect(cloudAnotherPost.title).toEqual('another title');
		});

		test('survives online -> offline -> update/online race', async () => {
			const post = await DataStore.save(
				new Post({
					title: 'a title',
				})
			);

			await waitForEmptyOutbox();
			await simulateDisconnect();

			const outboxEmpty = waitForEmptyOutbox();

			const retrieved = await DataStore.query(Post, post.id);
			await DataStore.save(
				Post.copyOf(retrieved!, updated => (updated.title = 'new title'))
			);

			// NO PAUSE: Simulate reconnect IMMEDIATELY, causing a race
			// between the save and the sync engine reconnection operations.

			await simulateConnect();
			await outboxEmpty;

			const table = graphqlService.tables.get('Post')!;
			expect(table.size).toEqual(1);

			const cloudPost = table.get(JSON.stringify([post.id])) as any;
			expect(cloudPost.title).toEqual('new title');
		});

		test('survives online -> offline -> delete/online race', async () => {
			const post = await DataStore.save(
				new Post({
					title: 'a title',
				})
			);

			await waitForEmptyOutbox();
			await simulateDisconnect();

			const outboxEmpty = waitForEmptyOutbox();

			const retrieved = await DataStore.query(Post, post.id);
			await DataStore.delete(retrieved!);

			// NO PAUSE: Simulate reconnect IMMEDIATELY, causing a race
			// between the save and the sync engine reconnection operations.

			await simulateConnect();
			await outboxEmpty;

			const table = graphqlService.tables.get('Post')!;
			expect(table.size).toEqual(1);

			const cloudPost = table.get(JSON.stringify([post.id])) as any;
			expect(cloudPost.title).toEqual('a title');
			expect(cloudPost._deleted).toEqual(true);
		});
	});

	describe('selective sync', () => {
		const generateTestData = async () => {
			const titles = [
				'1. doing laundry',
				'2. making dinner',
				'3. cleaning dishes',
				'4. taking out the trash',
				'5. cleaning your boots',
			];

			for (const title of titles) {
				await DataStore.save(
					new Post({
						title,
					})
				);
			}
		};

		const resyncWith = async (expressions: any[]) => {
			(DataStore as any).syncExpressions = expressions;
			await DataStore.start();
			await waitForDataStoreReady();
		};

		beforeEach(async () => {
			await generateTestData();

			// make sure "AppSync" has all the records.
			await waitForEmptyOutbox();

			// clear the local -- each test herein will configure sync expressions
			// and begin syncing on a clean database.
			await DataStore.clear();
		});

		/**
		 * Don't call `DataStore.configure()` directly. It will clobber the AppSync
		 * configuration and will no longer interact with the fake backend on restart.
		 */

		test('Predicates.ALL', async () => {
			await resyncWith([syncExpression(Post, () => Predicates.ALL)]);

			const records = await DataStore.query(Post);

			// This is working in integ tests. Need to dive on why
			// fake graphql service isn't handling Predicates.All.
			// expect(records.length).toBe(5);

			// leaving test in to validate the type.
		});

		test('Predicates.ALL async', async () => {
			await resyncWith([syncExpression(Post, async () => Predicates.ALL)]);

			const records = await DataStore.query(Post);

			// This is working in integ tests. Need to dive on why
			// fake graphql service isn't handling Predicates.All.
			// expect(records.length).toBe(5);

			// leaving test in to validate the type.
		});

		test('basic contains() filtering', async () => {
			await resyncWith([
				syncExpression(Post, post => post?.title.contains('cleaning')),
			]);

			const records = await DataStore.query(Post);
			expect(records.length).toBe(2);
		});

		test('basic contains() filtering - as synchronous condition producer', async () => {
			await resyncWith([
				syncExpression(Post, () => post => post.title.contains('cleaning')),
			]);

			const records = await DataStore.query(Post);
			expect(records.length).toBe(2);
		});

		test('basic contains() filtering - as asynchronous condition producer', async () => {
			await resyncWith([
				syncExpression(
					Post,
					async () => post => post.title.contains('cleaning')
				),
			]);

			const records = await DataStore.query(Post);
			expect(records.length).toBe(2);
		});

		test('omits implicit FK fields in selection set', async () => {
			// old CLI + amplify V5 + sync expressions resulted in broken sync queries,
			// where FK/connection keys were included in the sync queries, *sometimes*
			// resulting in incorrect sync queries.

			let selectionSet: string[];
			graphqlService.log = (message, query) => {
				if (
					message === 'Parsed Request' &&
					query.selection === 'syncLegacyJSONPosts'
				) {
					selectionSet = query.items;
				}
			};

			await resyncWith([
				syncExpression(LegacyJSONPost, p =>
					p?.title.eq("whatever, it doesn't matter.")
				),
			]);

			expect(selectionSet!).toBeDefined();
			expect(selectionSet!).toEqual([
				'id',
				'title',
				'createdAt',
				'updatedAt',
				'_version',
				'_lastChangedAt',
				'_deleted',
				'blog',
			]);
		});

		test('subscription query receives expected filter variable', async () => {
			await resyncWith([
				syncExpression(
					Post,
					async () => post => post.title.contains('cleaning')
				),
			]);

			// first 3 subscription requests are from calling DataStore.start in the `beforeEach`
			const [, , , onCreate, onUpdate, onDelete] = graphqlService.requests
				.filter(r => r.operation === 'subscription' && r.tableName === 'Post')
				.map(req => req.variables.filter);

			const expectedFilter = {
				and: [
					{
						title: {
							contains: 'cleaning',
						},
					},
				],
			};

			expect(onCreate).toEqual(expectedFilter);
			expect(onUpdate).toEqual(expectedFilter);
			expect(onDelete).toEqual(expectedFilter);
		});

		test('subscription query receives expected filter variable - nested', async () => {
			await resyncWith([
				syncExpression(
					Model,
					async () => m =>
						m.or(or => [
							or.and(and => [
								and.field1.eq('field'),
								and.createdAt.gt('1/1/2023'),
							]),
							or.and(and => [
								and.or(or => [
									or.optionalField1.beginsWith('a'),
									or.optionalField1.notContains('z'),
								]),
								and.emails.ne('-'),
							]),
						])
				),
			]);

			// first 3 subscription requests are from calling DataStore.start in the `beforeEach`
			const [, , , onCreate, onUpdate, onDelete] = graphqlService.requests
				.filter(r => r.operation === 'subscription' && r.tableName === 'Model')
				.map(req => req.variables.filter);

			expect(onCreate).toEqual(onUpdate);
			expect(onCreate).toEqual(onDelete);
			expect(onCreate).toMatchInlineSnapshot(`
			Object {
			  "or": Array [
			    Object {
			      "and": Array [
			        Object {
			          "field1": Object {
			            "eq": "field",
			          },
			        },
			        Object {
			          "createdAt": Object {
			            "gt": "1/1/2023",
			          },
			        },
			      ],
			    },
			    Object {
			      "and": Array [
			        Object {
			          "or": Array [
			            Object {
			              "optionalField1": Object {
			                "beginsWith": "a",
			              },
			            },
			            Object {
			              "optionalField1": Object {
			                "notContains": "z",
			              },
			            },
			          ],
			        },
			        Object {
			          "emails": Object {
			            "ne": "-",
			          },
			        },
			      ],
			    },
			  ],
			}
		`);
		});
	});
});
