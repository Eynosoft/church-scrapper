const puppeteer = require('puppeteer');
const json2csv = require('json2csv');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');


async function fetchDataForPage(page) {
  const jsonData = {
    extras: { sort: 'default' },
    facets: { search: [], results_pages: [], pages: [] },
    first_load: 0,
    frozen_facets: { search: 'hard' },
    http_params: { get: {}, uri: '', url_vars: { paged: page.toString() } }, 
    paged: page.toString(), 
    soft_refresh: 1,
    template: 'all_churches',
  };

  try {
    const response = await axios.post('https://churches.sbc.net/wp-json/facetwp/v1/refresh', {
      action: 'facetwp_refresh',
      data: jsonData,
    });

    console.log(`Template is extracted for ${page}.`)
    return response.data.template; 
  } catch (error) {
    console.error(`Error fetching data for page ${page}:`, error);
    return null; 
  }
}

const scrapeDataFromURLs = async (urls) => {
  const browser = await puppeteer.launch({
    headless: "new",
    defaultViewport: null,
    userDataDir: './temp',
  });

  const details = [];

  for (const url of urls) {
    const page = await browser.newPage();
    await page.goto(url);

    let name = 'Null';
    let address = 'Null';
    let email = 'Null';
    let phone = 'Null';

    try {
      name = await page.$eval('section > div > section > h1', (el) => el.textContent.trim().replace(/"/g, ''));
    } catch (error) {}

    try {
      address = await page.$eval('section > div > section > h3', (el) =>
        el.textContent.replace(/(<br>|[\n\t])/g, '').trim()
      );
    } catch (error) {}

    try {
      phone = await page.$eval('section > div > section > p:nth-child(6)', (el) => el.textContent.trim());
    } catch (error) {}

    try {
      email = await page.$eval('a[href^="mailto:"]', (el) => el.getAttribute('href').replace('mailto:', ''));
    } catch (error) {}

    details.push({ NAME: name, PHONE: phone, EMAIL: email, ADDRESS: address });

    console.log(`Data collected for ${url}`);

    await page.close();
  }

  if (details.length > 0) {
    const csvData = json2csv.parse(details);

    fs.writeFileSync('all_churches_data.csv', csvData, 'utf-8');
    console.log('Data saved to all_churches_data.csv');
  } else {
    console.log('No data to save.');
  }

  console.log('All pages scraped.');

  await browser.close();
};


(async () => {
  const totalPages = 2;
  const accumulatedURLs = [];

  for (let i = 1; i <= totalPages; i++) {
    try {
      const template = await fetchDataForPage(i);

      const $ = cheerio.load(template);
      const anchorTags = $('a');

      const urls = [];
      anchorTags.each((index, element) => {
        const url = $(element).attr('href');
        urls.push(url);
      });

      accumulatedURLs.push(...urls);
    } catch (error) {
      console.error('Error fetching or processing data:', error);
    }
  }

  console.log("All URLs accumulated.")

  await scrapeDataFromURLs(accumulatedURLs);
})();



