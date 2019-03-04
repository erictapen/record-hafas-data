'use strict'

const levelup = require('levelup')
const memdown = require('memdown')
const {Readable} = require('stream')
const test = require('tape')
const alphanumericId = require('alphanumeric-id')

const record = require('.')

const createLevelWithSpies = (onCreate, onBatch) => {
	return function _createDbWithSpies (path, opt, cb) {
		onCreate.apply({}, arguments)

		const args = [memdown(path)].concat(Array.from(arguments).slice(1))
		const db = levelup.apply({}, args)

		const origBatch = db.batch
		db.batch = function batchSpy (ops, cb) {
			onBatch(ops)
			return origBatch.apply(db, arguments)
		}

		cb(null, db)
	}
}

const createMockMonitor = (onStop) => {
	const monitor = new Readable({
		objectMode: true,
		read: () => {}
	})

	const writeDep = () => {
		monitor.push({
			tripId: alphanumericId(22),
			stop: {type: 'station', id: '1234567'},
			when: new Date(Date.now() + 40 * 1000).toISOString(),
			delay: 30,
			direction: 'one-direction', // haha
			line: {
				type: 'line',
				id: '123',
				name: '123 Line',
				public: true,
				mode: 'train'
			}
		})
	}

	let interval = setInterval(writeDep, 1 * 1000)
	monitor.stop = () => {
		if (interval !== null) {
			clearInterval(interval)
			interval = null
		}
		onStop()
	}

	return monitor
}

test('works', (t) => {
	const onStop = () => t.pass('stop called')
	const monitor = createMockMonitor(onStop)

	const onCreate = path => t.equal(path, '/foo')
	let stopped = false
	const onBatch = (ops) => {
		t.ok(Array.isArray(ops))
		t.ok(ops.length > 0)
		for (let op of ops) {
			t.ok(op)
			t.equal(op.key.slice(0, 2), '1-', 'namespace in key') // namespace
			t.ok(op.type, 'put')
			t.ok(op.value)
		}

		if (!stopped) {
			stopped = true
			recorder.stop()
			t.end()
		}
	}

	const recorder = record('/foo', monitor, createLevelWithSpies(onCreate, onBatch))
	recorder.on('error', t.ifError)
	// todo: check if emits events
})
