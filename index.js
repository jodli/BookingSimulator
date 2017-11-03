const puppeteer = require('puppeteer');
const fs = require('fs');
const csvWriter = require('csv-write-stream');

require('dotenv').config();
require('require-environment-variables')(['BASE_URL', 'PROJECTS_URL', 'AUTH_USER', 'AUTH_PASS']);

async function getProjects() {
	const projektSelector = '#ctl00_cphContent_cboProjects_DDD_L_LBT > tbody > tr';
	const projektInputSelector = '#ctl00_cphContent_cboProjects_I';
	const ladeElementSelector = '#ctl00_cphContent_cboProjects_LPV';
	const erfassungSelector = '#ctl00_cphContent_cboPSItem_0_DDD_L_LBT > tbody > tr';

	const writer = csvWriter({
		sendHeaders: true,
		separator: ';'
	});
	writer.pipe(fs.createWriteStream(process.env.PROJECT_OUTPUT_NAME || 'out.csv'));
	
	const browser = await puppeteer.launch({
		headless: false,
		timeout: 60000,
		userDataDir: 'D:/test/User Data',
		args: ['--no-sandbox', '--disable-setuid-sandbox']
	});
	const page = await browser.newPage();
	await page.setViewport({
		width: 1024,
		height: 786
	});

	console.debug('Navigate to mportal');
	page.goto(process.env.BASE_URL, {
		waitUntil: 'domcontentloaded'
	});

	await page.waitFor(5000);
	
	const responseAuth = await page.authenticate({
		username:process.env.AUTH_USER,
		password:process.env.AUTH_PASS
	});

	console.debug('Navigate to project times');
	await page.goto(process.env.BASE_URL + process.env.PROJECTS_URL, {
		waitUntil: 'domcontentloaded'
	});

	console.debug('Getting available projects');
	const projects = await page.evaluate((selector) => {
		var tds = Array.from(document.querySelectorAll(selector));
		return tds.map(td => td.textContent.trim());
	}, projektSelector);
	console.log(projects);

	for (var i = 0, len = projects.length; i < len; i++) {
		await page.waitFor(2000);
		console.debug('Selecting project ' + i + ' of ' + len);

		console.debug('Focusing project input field');
		const projectInput = await page.$(projektInputSelector);
		projectInput.focus();

		console.debug('Selecting all text');
		await page.keyboard.down('Control');
		await page.keyboard.down('A');

		await page.keyboard.up('A');
		await page.keyboard.up('Control');

		console.debug('Typing project name: ' + projects[i]);
		projectInput.type(projects[i]);

		console.debug('Waiting for loading elements to be added');
		await page.waitForSelector(ladeElementSelector, {
			visible: true
		});

		console.debug('Waiting for loading elements to be removed');
		await page.waitForSelector(ladeElementSelector, {
			hidden: true
		});

		console.debug('Selecting project');
		await projectInput.press('Enter');

		console.debug('Waiting for navigation');
		await page.waitForNavigation({
			waitUntil: 'domcontentloaded'
		});

		console.debug('Getting available registrations for this project');
		const registrations = await page.evaluate((selector) => {
			var tds = Array.from(document.querySelectorAll(selector));
			return tds.map(td => td.textContent.trim());
		}, erfassungSelector);
		console.log(registrations);

		console.debug('Writing data to csv');
		writer.write({Project: projects[i], Registrations: registrations});
	}

	console.log('Done.');
	writer.end();
	browser.close();
}

getProjects();
