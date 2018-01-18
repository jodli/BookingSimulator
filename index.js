const puppeteer = require('puppeteer');
const fs = require('fs');
const log = require('loglevel');
const program = require('commander');

require('dotenv').config();
require('require-environment-variables')(['BASE_URL', 'PROJECTS_URL', 'AUTH_USER', 'AUTH_PASS']);

async function selectFirstEntryInDropDown(projectInput) {
	log.info('Selecting first entry in drop down menu.');
	await projectInput.press('Enter');
}

async function typeInInputField(inputField, text) {
	log.info('Typing text', text);
	inputField.type(text, {
		delay: 10
	});
}

async function focusInputField(page, selector) {
	log.info('Focusing input field');
	const inputField = await page.$(selector);
	inputField.focus();
	return inputField;
}

async function waitForNavigation(page) {
	log.info('Waiting for a page reload.');
	await page.waitForNavigation({
		waitUntil: 'domcontentloaded'
	});
}

async function waitForLoadingElements(page) {
	const ladeElementSelector = '#ctl00_cphContent_cboProjects_LPV';

	log.info('Waiting for loading elements to be added');
	await page.waitForSelector(ladeElementSelector, {
		visible: true
	});
	log.info('Waiting for loading elements to be removed');
	await page.waitForSelector(ladeElementSelector, {
		hidden: true
	});
}

async function selectAllText(page) {
	log.info('Selecting all text');
	await page.keyboard.down('Control');
	await page.keyboard.down('A');
	await page.keyboard.up('A');
	await page.keyboard.up('Control');
}

async function startAndNavigateToProjectTimes(options) {
	log.info('Setting up browser.');
	const browser = await puppeteer.launch({
		headless: !options.interactiveMode,
		timeout: 60000,
		userDataDir: options.userDataDir,
		args: ['--no-sandbox', '--disable-setuid-sandbox']
	});

	const page = await browser.newPage();
	await page.setViewport({
		width: 1024,
		height: 786
	});

	log.info('Navigate to mportal');
	page.goto(process.env.BASE_URL, {
		waitUntil: 'domcontentloaded'
	});
	await page.waitFor(10000);

	//const responseAuth = await page.authenticate({
	//	username: process.env.AUTH_USER,
	//	password: process.env.AUTH_PASS
	//});

	log.info('Navigate to project times');
	await page.goto(process.env.BASE_URL + process.env.PROJECTS_URL, {
		waitUntil: 'domcontentloaded'
	});
	return { page, browser };
}

async function getProjects(outFile, options) {
	const csvWriter = require('csv-write-stream');

	const projektSelector = '#ctl00_cphContent_cboProjects_DDD_L_LBT > tbody > tr';
	const projektInputSelector = '#ctl00_cphContent_cboProjects_I';
	const erfassungSelector = '#ctl00_cphContent_cboPSItem_0_DDD_L_LBT > tbody > tr';

	log.info('Setting up csv writer.');
	const writer = csvWriter({
		sendHeaders: true,
		separator: ';'
	});
	writer.pipe(fs.createWriteStream(outFile));

	const { page, browser } = await startAndNavigateToProjectTimes(options);

	log.info('Getting available projects');
	const projects = await page.evaluate((selector) => {
		var tds = Array.from(document.querySelectorAll(selector));
		return tds.map(td => td.textContent.trim());
	}, projektSelector);
	log.info(projects);

	for (var i = 0, len = projects.length; i < len; i++) {
		await page.waitFor(2000);
		log.info('Selecting project ' + i + ' of ' + len);

		const projectInput = await focusInputField(page, projektInputSelector);

		await selectAllText(page);

		typeInInputField(projectInput, projects[i]);

		await waitForLoadingElements(page);

		await selectFirstEntryInDropDown(projectInput);

		await waitForNavigation(page);

		log.info('Getting available registrations for this project');
		const registrations = await page.evaluate((selector) => {
			var tds = Array.from(document.querySelectorAll(selector));
			return tds.map(td => td.textContent.trim());
		}, erfassungSelector);
		log.info(registrations);

		log.info('Writing data to csv');
		writer.write({ Project: projects[i], Registrations: registrations });
	}

	log.info('Done.');
	writer.end();
	log.info('Closed csv stream.');
	await page.waitFor(10000);
	browser.close();
	log.info('Closed browser.');
}

async function bookProjects(inFile, options) {
	const csvReader = require('fast-csv');

	let bookingPositions = [];
	log.info('Setting up csv reader.');
	const csvStream = csvReader.fromStream(
		fs.createReadStream(inFile), {
			delimiter: ';',
			headers: true,
			comment: '#',
			ignoreEmpty: true
		}
	).on('data', async (data) => {
		log.info(data);
		bookingPositions.push(data);
		log.info("Booking position list now contains: " + bookingPositions.length);
	}).on('end', async (data) => {
		log.info('No more rows.');
	});

	const projektInputSelector = '#ctl00_cphContent_cboProjects_I';
	const projektErfassungSelector = '#ctl00_cphContent_cboPSItem_0_I';
	const datumSelector = '#ctl00_cphContent_ctl37_I';
	const dauerSelector = '#ctl00_cphContent_txtTimeRegAmountHoursMinutes_I';
	const bemerkungenSelector = '#ctl00_cphContent_txtRemarks';
	const projektzeitErfassenSelector = '#ctl00_cphContent_cmdTimeRegAmount_CD';

	const { page, browser } = await startAndNavigateToProjectTimes(options);

	await page.waitFor(5000);

	for (let i = 0; i < bookingPositions.length; i++) {
		const element = bookingPositions[i];
		await page.waitFor(2000);

		log.info('Setting project to', element.Project);
		const projectInput = await focusInputField(page, projektInputSelector);
		await selectAllText(page);
		typeInInputField(projectInput, element.Project);
		await waitForLoadingElements(page);
		await page.waitFor(2000);
		await selectFirstEntryInDropDown(projectInput);
		await waitForNavigation(page);

		log.info('Setting registration to', element.Registration);
		const registrationInput = await focusInputField(page, projektErfassungSelector);
		await selectAllText(page);
		typeInInputField(registrationInput, element.Registration);
		await page.waitFor(2000);
		await selectFirstEntryInDropDown(registrationInput);
		await waitForNavigation(page);

		log.info('Setting date to', element.Date);
		const dateInput = await focusInputField(page, datumSelector);
		await selectAllText(page);
		typeInInputField(dateInput, element.Date);
		await page.waitFor(2000);
		await selectFirstEntryInDropDown(dateInput);
		await waitForNavigation(page);

		log.info('Setting duration to', element.Duration);
		const durationInput = await focusInputField(page, dauerSelector);
		await selectAllText(page);
		typeInInputField(durationInput, element.Duration);
		await page.waitFor(2000);

		log.info('Setting comment to', element.Comment);
		const commentInput = await focusInputField(page, bemerkungenSelector);
		await selectAllText(page);
		typeInInputField(commentInput, element.Comment);
		await page.waitFor(2000);

		log.info('Submitting booking.');
		await page.click(projektzeitErfassenSelector);
		await waitForNavigation(page);

		log.info('Successfully booked entry:', element);
	}

	log.info('Done.');
	await page.waitFor(10000);
	browser.close();
	log.info('Closed browser.');
}

log.setLevel('warn');
program.version('0.1.0');

program
	.command('getProjects <path>')
	.description('Gets all projects and its registrations and writes them in .csv format to <path>.')
	.option('-v, --verbose', 'Enables verbose logging.')
	.option('-t, --trace', 'Enables trace logging.')
	.option('-i, --interactive-mode', 'Shows the browser window.')
	.option('-u, --user-data-dir <userDataDir>', 'Specifies the user data dir for the chromium.')
	.action((path, options) => {
		if (options.verbose) {
			log.setLevel('info');
			log.info('Enabled verbose logging.');
		}
		if (options.trace) {
			log.enableAll();
			log.trace('Enabled trace logging.');
		}
		if (options.interactiveMode) {
			log.info('Running the browser in interactive mode.');
		}
		if (options.userDataDir) {
			log.info('UserDataDir is: ' + options.userDataDir);
		}
		log.info('Getting projects and their registrations and writing them to: ' + path);
		getProjects(path, options);
	});

program
	.command('bookProjects <path>')
	.description('Books all positions contained in the .csv file at the given [path].')
	.option('-v, --verbose', 'Enables verbose logging.')
	.option('-t, --trace', 'Enables trace logging.')
	.option('-i, --interactive-mode', 'Shows the browser window.')
	.option('-u, --user-data-dir <userDataDir>', 'Specifies the user data dir for the chromium.')
	.action((path, options) => {
		if (options.verbose) {
			log.setLevel('info');
			log.info('Enabled verbose logging.');
		}
		if (options.trace) {
			log.enableAll();
			log.trace('Enabled trace logging.');
		}
		if (options.interactiveMode) {
			log.info('Running the browser in interactive mode.');
		}
		if (options.userDataDir) {
			log.info('UserDataDir is: ' + options.userDataDir);
		}
		log.info('Booking all positions specified in: ' + path);
		bookProjects(path, options);
	});

program.parse(process.argv);