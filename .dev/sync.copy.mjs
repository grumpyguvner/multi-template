import { EventEmitter } from 'node:events';
import fs from 'node:fs';

const tempFolder = `${import.meta.dirname}/${
	process.env.TEMP_FOLDER || '.temp'
}`;

const copyFolder = (project, item) => {
	return new Promise((resolve, reject) => {
		if (!item.destination.endsWith('/')) {
			item.destination += '/';
		}
		console.log(
			`Updating directory ${item.destination} from ${project}/${item.source}`
		);

		fs.cp(
			`${tempFolder}/${project}/${item.source}`,
			item.destination,
			item?.options ?? {
				recursive: true,
				force: true,
			},
			(error) => {
				if (error) {
					console.error(error);
					reject(error);
				}
				resolve();
			}
		);
	});
};

const copyFile = (project, item) => {
	return new Promise((resolve, reject) => {
		console.log(
			`Updating file ${item.destination} from ${project}/${item.source}`
		);
		const destinationFolder = `./${item.destination.substring(
			0,
			item.destination.lastIndexOf('/')
		)}`;
		console.log(`Destination folder: ${destinationFolder}`);
		if (!fs.existsSync(destinationFolder)) {
			console.log(`Creating: ${destinationFolder}`);
			fs.mkdirSync(destinationFolder, { recursive: true });
			console.log(`Created: ${destinationFolder}`);
		}
		fs.copyFile(
			`${tempFolder}/${project}/${item.source}`,
			item.destination,
			(error) => {
				if (error) {
					console.error(error);
					reject(error);
				}
				resolve();
			}
		);
	});
};

// Create our copying service
class CopyingService extends EventEmitter {
	#itemQueue = [];
	#copiedItems = [];
	#inProgress = false;

	#copyItem(project, item) {
		return new Promise((resolve, reject) => {
			if (typeof item === 'string') {
				item = { source: item, destination: item };
			}
			if (!item.destination) {
				item.destination = item.source;
			}
			console.log(
				`Copying ${item.source} of project ${project} to ${item.destination}`
			);
			if (!fs.existsSync(`${tempFolder}/${project}/${item.source}`)) {
				reject(new Error(`Source ${source} does not exist`));
			}
			if (
				fs
					.statSync(`${tempFolder}/${project}/${item.source}`)
					.isDirectory()
			) {
				copyFolder(project, item)
					.then(() => {
						resolve();
					})
					.catch((error) => {
						reject(error);
					});
			} else {
				copyFile(project, item)
					.then(() => {
						resolve();
					})
					.catch((error) => {
						reject(error);
					});
			}
		});
	}

	#processQueue() {
		if (!this.#inProgress && this.#itemQueue.length > 0) {
			this.#inProgress = true;
			const { project, item } = this.#itemQueue.shift();
			this.#copyItem(project, item)
				.then(() => {
					this.emit('copied', {
						project,
						item,
					});
					this.#copiedItems.push({
						project,
						item,
					});
					this.#inProgress = false;
					this.#processQueue();
				})
				.catch((error) => {
					this.emit('error', error);
					this.#inProgress = false;
					this.#processQueue();
				});
		}
	}

	allFinished() {
		this.#processQueue();
		return 0 == this.#itemQueue.length + (this.#inProgress ? 1 : 0);
	}

	queueCopy(project, item) {
		if (
			this.#itemQueue.includes({
				project,
				item,
			}) ||
			this.#copiedItems.includes({
				project,
				item,
			})
		) {
			return;
		}
		this.#itemQueue.push({ project, item });
		console.debug(`Queued copy of ${JSON.stringify(item)} from ${project}`);
		this.emit('itemQueued', { project, item });
	}
}
const copyingService = new CopyingService();

export default copyingService;
