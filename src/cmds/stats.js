import { getConfigs } from '../config';
import getStorage from '../storage';
import getComparer from '../compare';
import Stats from '../stats';
import async from 'async';

export const command = 'stats <storage..>';
export const desc = 'Compute stats for storage bindings and/or environments';
export const builder = {
  storage: {
    describe: 'Provide one or more storage bindings you wish to compute stats for',
    type: 'array'
  }
};

export const handler = argv => {
  const stats = new Stats();

  const tasks = [];
  getConfigs(argv, (err, configs) => {
    if (err) return void console.error(err);

    let configStorages = {};
    // compare every config+storage combo against one another
    configs.forEach(config => {
      argv.storage.forEach(storage => {
        const configStorageId = `${config.id}.${storage}`;
        if (!configStorages[configStorageId]) {
          configStorages[configStorageId] = {
            id: configStorageId,
            config: config,
            storage: getStorage(config, storage)
          };
        }
      });
    });

    // turn hash into array
    configStorages = Object.keys(configStorages).map(id => configStorages[id]);

    configStorages.forEach(src => {
      tasks.push(getTask(src, stats));
    });

    if (tasks.length === 0) return void console.error('No tasks detected, see help');

    const statsTimer = setInterval(() => console.log(stats.toString() + '\nComputing stats...'), 1000);
    statsTimer.unref();

    // process all comparisons
    async.series(tasks, (err, results) => {
      clearInterval(statsTimer);
      console.log(stats.toString());

      if (err) {
        console.error('Stats has failed, aborting...', err);
      } else {
        console.log('Stats complete');
      }
    });
    
  });
};

function getTask(src, stats) {
  const statInfo = stats.getStats(src.config, src.storage);
  return cb => {
    statInfo.running();
    task(src.config, src.storage, statInfo, (err) => {
      statInfo.complete();
      cb(err);
    });
  };
}

function task(srcConfig, srcStorage, statInfo, cb) {
  const compareFiles = (err, files, dirs, lastKey) => {
    if (err) return void cb(err);

    files.forEach(f => {
      statInfo.match(f.Size);
    });

    if (!lastKey) { // we're done, no more files to compare
      return void cb();
    }

    srcStorage.list('', { deepQuery: true, maxKeys: 5000, lastKey }, compareFiles);
  };

  srcStorage.list('', { deepQuery: true, maxKeys: 5000 }, compareFiles);
}
