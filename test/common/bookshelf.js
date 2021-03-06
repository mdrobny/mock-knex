import {
  describe,
  expect,
  before,
  beforeEach,
  afterEach,
  after,
  it,
} from './lab';

import Bookshelf from 'bookshelf';
import mod from '../../';
import tracker from '../../dist/tracker';
import { MockSymbol } from '../../dist/util/transformer';

export default (db) => {
  describe('Bookshelf', () => {
    let Model;
    let Collection;

    before((done) => {
      mod.mock(db);

      const bookshelf = Bookshelf(db);

      Model = bookshelf.Model.extend({
        tableName : 'models'
      });

      Collection = bookshelf.Collection.extend({
        model : Model
      });

      done();
    });

    beforeEach((done) => {
      tracker.install();
      done();
    });

    afterEach((done) => {
      tracker.uninstall();
      done();
    });

    after((done) => {
      mod.unmock(db);
      done();
    })

    describe('Models', () => {
      it('should work with Model#fetch', (done) => {
        tracker.on('query', (query) =>{
          query.response([
            {
              id : 1,
              foo : 'bar'
            }
          ]);
        });

        Model.forge({ id : 1 }).fetch()
             .then((model) => {
               expect(model).to.be.an.instanceof(Model);
               expect(model.get('id')).to.equal(1);
               expect(model.get('foo')).to.equal('bar');
               done();
             });
      });

      it('should work with Model#fetchAll', (done) => {
        tracker.on('query', (query) => {
          query.response([
            {
              id : 1,
              foo : 'bar'
            },
            {
              id : 2,
              foo : 'baz'
            }
          ]);
        });

        Model.forge({ id : 1 }).fetchAll()
          .then((collection) => {
            expect(collection.length).to.equal(2);
            expect(collection.models[0].get('foo')).to.equal('bar');
            expect(collection.models[1].get('foo')).to.equal('baz');

            done();
          });
      });

      it('should work with Model#count', (done) => {
        tracker.on('query', (query) => {
          try {
            expect(query.sql).to.equal('select count("count") as "count" from "models" where "color" = ?');
          } catch (e) {
            expect(query.sql).to.equal('select count(`count`) as `count` from `models` where `color` = ?');
          }

          expect(query.method).to.equal('select');

          query.response([{
            count : 10,
          }]);
        });

        Model.forge()
        .where('color', 'blue')
        .count('count')
        .then((count) => {
            expect(count).to.equal(10);
            done();
          });
      });

      it('should work with Model#save update with transaction', (done) => {
        var bookshelf = require('bookshelf')(db);

        tracker.on('query', (query, step) => {
          switch (step) {
            case 1:
              expect(query.sql.toLowerCase()).to.equal('begin;');
              query.response([]);
              break;
            case 2:
              expect(query.method).to.equal('update');
              expect(query.bindings).to.include('bar');
              query.response([])
              break;
            case 3:
              expect(query.sql.toLowerCase()).to.equal('commit;');
              query.response([]);
              break;
          }
        });

        bookshelf.transaction((trx) => {
          return Model.forge({ id : 10, foo : 'bar' }).save(null, {
            transacting : trx,
          }).then((model) => {

            expect(model.get('foo')).to.eql('bar');
          }).asCallback(done);
        });
      });

      it('should work with Model#save on updates', (done) => {
        tracker.on('query', (query) => {
          expect(query.method).to.equal('update');
          expect(query.bindings).to.include('bar');
          expect(query.bindings).to.looseInclude(10);
          done();
        });

        Model.forge({ id : 10, foo : 'bar' }).save();
      });

      it('should work with Model#save on inserts', (done) => {
        tracker.on('query', (query) => {
          expect(query.method).to.equal('insert');
          expect(query.bindings).to.include('bar');
          done();
        });

        Model.forge({ foo : 'bar' }).save();
      });

      it('should work with Model#destroy', (done) => {
        tracker.on('query', (query) => {
          expect(query.method).to.equal('del');
          done();
        });

        Model.forge({ id : 1, foo : 'bar' }).destroy();
      });
    });

    describe('Collections', function collectionTests() {
      it('should work with Collection#fetch method', (done) => {
        tracker.on('query', (query) => {
          query.response([
            {
              id : 1,
              foo : 'bar'
            },
            {
              id : 2,
              foo : 'baz'
            }
          ]);
        });

        Collection.forge().fetch()
                          .then((collection) => {
                            expect(collection.length).to.equal(2);
                            expect(collection.models[0].get('foo')).to.equal('bar');
                            expect(collection.models[1].get('foo')).to.equal('baz');

                            done();
                          });
      });

      it('should work with Collection#fetchOne method', (done) => {
        tracker.on('query', (query) => {
          expect(query.bindings[0]).to.looseEqual(2);
          expect(query.bindings[1]).to.looseEqual(1);

          done();
        });

        Collection.forge().query({
          where : {
            id : 2
          }
        }).fetchOne();
      });
    });
  });
}
