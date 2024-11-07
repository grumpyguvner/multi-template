import { EventEmitter } from 'node:events';
import { exec } from 'node:child_process';

const tempFolder = `${import.meta.dirname}/${
	process.env.TEMP_FOLDER || '.temp'
}`;

// Create our cloning service
class CloningService extends EventEmitter {
	#projectQueue = [];
	#clonedProjects = [];
	#inProgress = false;

	#cloneProject(project, use_https = false, branch = 'main') {
		return new Promise((resolve, reject) => {
			console.log(`Clone of project ${project} started`);
			console.log(`USE_HTTPS ${USE_HTTPS}`);
			const projectUrl = use_https
				? `https://github.com/${project}`
				: `git@github.com:${project}`;
			const clone = exec(
				`git clone --branch ${branch} --depth 1 ${projectUrl} ${tempFolder}/${project}`
			);
			clone.once('exit', (code) => {
				if (!code === 0) {
					reject(new Error(`Clone of project ${project} failed`));
				} else {
					queueMicrotask(() => {
						// Give the clone a few seconds to complete before resolving
						setTimeout(() => {
							console.log(`Clone of project ${project} complete`);
							resolve();
						}, 3000);
					});
				}
			});
		});
	}

	#processQueue() {
		if (!this.#inProgress && this.#projectQueue.length > 0) {
			this.#inProgress = true;
			const { project, use_https, branch } = JSON.parse(
				this.#projectQueue.shift()
			);
			this.#clonedProjects.push(
				JSON.stringify({ project, use_https, branch })
			);
			this.#cloneProject(project, use_https, branch)
				.then(() => {
					this.emit(
						'cloned',
						JSON.stringify({ project, use_https, branch })
					);
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
		return 0 == this.#processQueue.length + (this.#inProgress ? 1 : 0);
	}

	clone(project, use_https = false, branch = 'main') {
		if (
			this.#projectQueue.includes(
				JSON.stringify({ project, use_https, branch })
			) ||
			this.#clonedProjects.includes(
				JSON.stringify({ project, use_https, branch })
			)
		) {
			console.debug(
				`Project ${project} branch ${branch} already queued or cloned`
			);
			return;
		}
		console.debug(`Project ${project} branch ${branch} queued for cloning`);
		this.#projectQueue.push(JSON.stringify({ project, use_https, branch }));
		this.emit(
			'projectQueued',
			JSON.stringify({ project, use_https, branch })
		);
		this.#processQueue();
	}
}
const cloningService = new CloningService();

export default cloningService;
