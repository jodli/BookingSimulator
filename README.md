# BookingSimulator

This tool provides access to a SAGE HR portal using the [Puppeteer library from Google](https://github.com/GoogleChrome/puppeteer).

### Requirements
- Node v7.6.0 or greater

### Usage
1. Add correct data to the .env file.
2. Install dependencies (npm install)
3. Call desired script.

#### Available scripts
To get your projects and registrations:
```
node index.js getProjects -i "pathToOutputFile.csv" 
```

To book your work hours to projects:
```
node index.js bookProjects -i "pathToInputFile.csv"
```

#### Issues
- Certificate selection and authentication cannot be automated at the moment.
- There is a timeout for these manual tasks of about 30 seconds.
- Therefore Interactive mode (-i) is required.