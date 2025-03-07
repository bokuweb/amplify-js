import { PersistentModelConstructor } from '../../src';
import {
	initSchema as _initSchema,
	DataStore as DataStoreInstance,
} from '../../src/datastore/datastore';
import { FakeGraphQLService, FakeDataStoreConnectivity } from './fakes';
import {
	testSchema,
	ModelWithBoolean,
	Blog,
	Post,
	Comment,
	User,
	Profile,
	PostComposite,
	PostCustomPK,
	PostCustomPKSort,
	PostCustomPKComposite,
	DefaultPKParent,
	DefaultPKChild,
	HasOneParent,
	HasOneChild,
	Model,
	MtmLeft,
	MtmRight,
	MtmJoin,
	DefaultPKHasOneParent,
	DefaultPKHasOneChild,
	LegacyJSONPost,
	LegacyJSONComment,
	CompositePKParent,
	CompositePKChild,
	BasicModel,
	BasicModelWritableTS,
	BasicModelRequiredTS,
	ModelWithExplicitOwner,
	ModelWithExplicitCustomOwner,
	ModelWithMultipleCustomOwner,
	ModelWithIndexes,
} from './schemas';

type initSchemaType = typeof _initSchema;
type DataStoreType = typeof DataStoreInstance;

/**
 * Re-requries DataStore, initializes the test schema.
 *
 * Clears ALL mocks and modules in doing so.
 *
 * @returns The DataStore instance and models from `testSchema`.
 */
export function getDataStore({
	online = false,
	isNode = true,
	storageAdapterFactory = () => undefined as any,
} = {}) {
	jest.clearAllMocks();
	jest.resetModules();

	const connectivityMonitor = new FakeDataStoreConnectivity();
	const graphqlService = new FakeGraphQLService(testSchema());

	/**
	 * Simulates the (re)connection of all returned fakes/mocks that
	 * support disconnect/reconnect faking.
	 *
	 * All returned fakes/mocks are CONNECTED by default.
	 *
	 * `async` to set the precedent. In reality, these functions are
	 * not actually dependent on any async behavior yet.
	 */
	async function simulateConnect(log = false) {
		if (log) console.log('starting simulated connect.');

		// signal first, as the local interfaces would normally report
		// online status before services are available.
		await connectivityMonitor.simulateConnect();
		if (log) console.log('signaled reconnect in connectivity monitor');

		await graphqlService.simulateConnect();
		if (log) console.log('simulated graphql service reconnection');

		if (log) console.log('done simulated connect.');
	}

	/**
	 * Simulates the disconnection of all returned fakes/mocks that
	 * support disconnect/reconnect faking.
	 *
	 * All returned fakes/mocks are CONNECTED by default.
	 *
	 * `async` to set the precedent. In reality, these functions are
	 * not actually dependent on any async behavior yet.
	 */
	async function simulateDisconnect(log = false) {
		if (log) console.log('starting simulated disconnect.');

		await graphqlService.simulateDisconnect();
		if (log) console.log('disconnected graphql service');

		await connectivityMonitor.simulateDisconnect();
		if (log) console.log('signaled disconnect in connectivity monitor');

		if (log) console.log('done simulated disconnect.');
	}

	jest.mock('@aws-amplify/core', () => {
		const actual = jest.requireActual('@aws-amplify/core');
		return {
			...actual,
			browserOrNode: () => ({
				isBrowser: !isNode,
				isNode,
			}),
			JS: {
				...actual.JS,
				browserOrNode: () => {
					throw new Error(
						'amplify/core::JS.browserOrNode() does not exist anymore'
					);
				},
			},
		};
	});

	const {
		initSchema,
		DataStore,
	}: {
		initSchema: initSchemaType;
		DataStore: DataStoreType;
	} = require('../../src/datastore/datastore');

	DataStore.configure({
		storageAdapter: storageAdapterFactory(),
	});

	// private, test-only DI's.
	if (online) {
		(DataStore as any).amplifyContext.API = graphqlService;
		(DataStore as any).connectivityMonitor = connectivityMonitor;
		(DataStore as any).amplifyConfig.aws_appsync_graphqlEndpoint =
			'https://0.0.0.0/graphql';
	}

	const schema = testSchema();
	const classes = initSchema(schema);

	const {
		ModelWithBoolean,
		Blog,
		Post,
		Comment,
		User,
		Profile,
		PostComposite,
		PostCustomPK,
		PostCustomPKSort,
		PostCustomPKComposite,
		DefaultPKParent,
		DefaultPKChild,
		HasOneParent,
		HasOneChild,
		Model,
		MtmLeft,
		MtmRight,
		MtmJoin,
		DefaultPKHasOneParent,
		DefaultPKHasOneChild,
		LegacyJSONPost,
		LegacyJSONComment,
		CompositePKParent,
		CompositePKChild,
		BasicModel,
		BasicModelWritableTS,
		BasicModelRequiredTS,
		ModelWithExplicitOwner,
		ModelWithExplicitCustomOwner,
		ModelWithMultipleCustomOwner,
		ModelWithIndexes,
	} = classes as {
		ModelWithBoolean: PersistentModelConstructor<ModelWithBoolean>;
		Blog: PersistentModelConstructor<Blog>;
		Post: PersistentModelConstructor<Post>;
		Comment: PersistentModelConstructor<Comment>;
		User: PersistentModelConstructor<User>;
		Profile: PersistentModelConstructor<Profile>;
		PostComposite: PersistentModelConstructor<PostComposite>;
		PostCustomPK: PersistentModelConstructor<PostCustomPK>;
		PostCustomPKSort: PersistentModelConstructor<PostCustomPKSort>;
		PostCustomPKComposite: PersistentModelConstructor<PostCustomPKComposite>;
		DefaultPKParent: PersistentModelConstructor<DefaultPKParent>;
		DefaultPKChild: PersistentModelConstructor<DefaultPKChild>;
		HasOneParent: PersistentModelConstructor<HasOneParent>;
		HasOneChild: PersistentModelConstructor<HasOneChild>;
		Model: PersistentModelConstructor<Model>;
		MtmLeft: PersistentModelConstructor<MtmLeft>;
		MtmRight: PersistentModelConstructor<MtmRight>;
		MtmJoin: PersistentModelConstructor<MtmJoin>;
		DefaultPKHasOneParent: PersistentModelConstructor<DefaultPKHasOneParent>;
		DefaultPKHasOneChild: PersistentModelConstructor<DefaultPKHasOneChild>;
		LegacyJSONPost: PersistentModelConstructor<LegacyJSONPost>;
		LegacyJSONComment: PersistentModelConstructor<LegacyJSONComment>;
		CompositePKParent: PersistentModelConstructor<CompositePKParent>;
		CompositePKChild: PersistentModelConstructor<CompositePKChild>;
		BasicModel: PersistentModelConstructor<BasicModel>;
		BasicModelWritableTS: PersistentModelConstructor<BasicModelWritableTS>;
		BasicModelRequiredTS: PersistentModelConstructor<BasicModelRequiredTS>;
		ModelWithExplicitOwner: PersistentModelConstructor<ModelWithExplicitOwner>;
		ModelWithExplicitCustomOwner: PersistentModelConstructor<ModelWithExplicitCustomOwner>;
		ModelWithMultipleCustomOwner: PersistentModelConstructor<ModelWithMultipleCustomOwner>;
		ModelWithIndexes: PersistentModelConstructor<ModelWithIndexes>;
	};

	return {
		DataStore,
		schema,
		connectivityMonitor,
		graphqlService,
		simulateConnect,
		simulateDisconnect,
		ModelWithBoolean,
		Blog,
		Post,
		Comment,
		User,
		Profile,
		PostComposite,
		PostCustomPK,
		PostCustomPKSort,
		PostCustomPKComposite,
		DefaultPKParent,
		DefaultPKChild,
		HasOneParent,
		HasOneChild,
		Model,
		MtmLeft,
		MtmRight,
		MtmJoin,
		DefaultPKHasOneParent,
		DefaultPKHasOneChild,
		LegacyJSONPost,
		LegacyJSONComment,
		CompositePKParent,
		CompositePKChild,
		BasicModel,
		BasicModelWritableTS,
		BasicModelRequiredTS,
		ModelWithExplicitOwner,
		ModelWithExplicitCustomOwner,
		ModelWithMultipleCustomOwner,
		ModelWithIndexes,
	};
}
