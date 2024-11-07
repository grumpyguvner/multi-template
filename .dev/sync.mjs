//
// Updates files and folders that have been pulled from other projects.
//
// This file is owned by carmendata/swarm, any changes to be made to this file
// should be made in that repo otherwise they will be overwritten.

import cloningService from './sync.clone.mjs';
cloningService.on('error', (error) => {
	console.error(error);
});

import copyingService from './sync.copy.mjs';
copyingService.on('error', (error) => {
	console.error(error);
});

let USE_HTTPS = false;
let CURRENT_PROJECT = '';

console.log('Updating shared files ...');

console.log(`Folder ${import.meta.dirname}`);
const tempFolder = `${import.meta.dirname}/${
	process.env.TEMP_FOLDER || '.temp'
}`;
console.log(`Temp folder ${tempFolder}`);

import fs from 'node:fs';
import { exec } from 'node:child_process';

const exit = async (code = 0) => {
	if (code === 0) {
		console.log('Success');
		await cleanup();
	}
	console.log('Finished updating files.');
	process.exit(code);
};

const cleanup = () => {
	return new Promise((resolve, reject) => {
		// Remove the temporary directory
		if (fs.existsSync(tempFolder)) {
			console.log('Removing temporary files ...');
			// fs.rmSync(tempFolder, { recursive: true, force: true, maxRetries: 10 });
			const sh = exec(`rm -rf ${tempFolder}`);
			sh.once('exit', (code) => {
				if (code === 0) {
					console.log('Temporary files removed');
					resolve();
				} else {
					reject(new Error('Failed to remove temporary files'));
				}
			});
		} else {
			console.log('No temporary files to remove');
			resolve();
		}
	});
};

const processItem = (item, file) => {
	// Require the project property
	if (!item?.project) {
		reject(new Error(`Missing 'project' property in ${file}`));
	}
	// If the project does not include a slash, default by prepending carmendata/
	if (!item.project.includes('/')) {
		item.project = `carmendata/${item.project}`;
	}
	// If the project property matches the current project, ignore it
	if (item.project === CURRENT_PROJECT) {
		console.log(`Skipping files in current project ${CURRENT_PROJECT}`);
		return;
	} else {
		cloningService.clone(item.project, USE_HTTPS, item?.branch);
		// Files is optional, default to an empty array
		const files = item?.files ?? [];
		// If files is not an array, convert it to an array
		if (!Array.isArray(files)) {
			files = [files];
		}
		// Iterate through the files array and submit them for processing
		for (const file of files) {
			copyingService.queueCopy(item.project, file);
		}
	}
};

const processArray = async (parsedData, file) => {
	try {
		for (const item of parsedData) {
			processItem(item, file);
		}
	} catch (error) {
		throw error;
	}
};

const processSyncFiles = async (files) => {
	try {
		const promiseArray = [];
		for (const file of files) {
			const data = fs.readFileSync(`.dev/${file}`, 'utf8');
			try {
				const parsedData = JSON.parse(data);
				// If parsedData is not an array, convert it to an array
				if (!Array.isArray(parsedData)) {
					parsedData = [parsedData];
				}
				promiseArray.push(processArray(parsedData, file));
			} catch (error) {
				throw error;
			}
		}
		await Promise.all(promiseArray);
	} catch (error) {
		throw error;
	}
};

const findAllSyncFiles = async () => {
	try {
		const files = fs
			.readdirSync('.dev')
			.filter((file) => file.endsWith('.json'));
		await processSyncFiles(files);
	} catch (error) {
		throw error;
	}
};

const mainProcess = async () => {
	try {
		await cleanup();
		await findAllSyncFiles();
	} catch (error) {
		throw error;
	}
};

const repoName = () => {
	return new Promise((resolve, reject) => {
		let currentProject;
		try {
			// Fetch this repo name from .git/config
			const gitConfig = fs.readFileSync('.git/config', 'utf8');
			// Get the line "url =" from the origin remote
			const originUrl = gitConfig.match(/(?<=url = )(.*)(?=\n)/)[0];
			console.log(`Origin URL: ${originUrl}`);
			// The repo name is the part of the URL after github.com: and before .git
			currentProject = originUrl.match(
				/(?<=github.com[:\/])(.*)(?=.git)/
			)[0];
			console.log(`Repo name: ${currentProject}`);
			// If the URL starts with https://, use HTTPS
			if (originUrl.startsWith('https://')) {
				console.log(`Using HTTPS for cloning`);
				USE_HTTPS = true;
			}
			resolve(currentProject);
		} catch (error) {
			reject(error);
		}
		return currentProject;
	});
};
repoName()
	.then((projectName) => {
		CURRENT_PROJECT = projectName;
		console.log(`Current project: ${CURRENT_PROJECT}`);
		mainProcess();
	})
	.catch((error) => {
		console.error(error);
	});

while (!cloningService.allFinished()) {
	console.log('Waiting for cloning to finish ...');
	await new Promise((resolve) => setTimeout(resolve, 2000));
}

while (!copyingService.allFinished()) {
	console.log('Waiting for copying to finish ...');
	await new Promise((resolve) => setTimeout(resolve, 2000));
}
console.log('Main process finished ...');
exit(0);
