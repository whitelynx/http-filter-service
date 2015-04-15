var childProcess = require('child_process');

var _ = require('lodash');
var express = require('express');
var shellQuote = require('shell-quote');

var config = require('./config');
var package = require('./package');


// Copied and combined from lodash:
var interpolateRE = /<%=([\s\S]+?)%>|\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g;

var filters = _.mapValues(config.filters, function(filterDef)
{
    var template = _.template(filterDef);

    template.params = [];
    var match;
    while((match = interpolateRE.exec(filterDef)))
    {
        template.params.push(match[1] || match[2]);
    } // end while

    return template;
});


// Message templates:
var availableFiltersSnippet = '\n\nAvailable filters:\n' +
    '<% _.forEach(filters, function(filter, name) { %> - ${name}' +
        '<% if(filter.params.length > 0) { %> ' +
            '(parameters:<% _.forEach(filter.params, function(option, idx) { if(idx > 0) { %>,<% } %> ${option}<% }) %>)' +
        '<% } %>' +
    '\n<% }) %>';

var usageMsg = _.template(
    'Usage:\n\n  curl -X POST "http://${address.address}:${address.port}/[filter]?[option]=[val]&..." --data-binary @[inputFile]' +
    availableFiltersSnippet
);
var unknownFilterMsg = _.template('Bad Request: No filter named ${filterName} found!' + availableFiltersSnippet);


var app = express();

var address, usage;

app.get('/', function(req, res)
{
    res.send(usage);
});

app.post('/:filterName', function(req, res)
{
    var filter = filters[req.params.filterName];
    if(filter)
    {
        var command = shellQuote.parse(filter(req.query));

        var process = childProcess.spawn(command[0], command.slice(1));

        req.pipe(process.stdin);

        var stdoutData = [], stdoutLength = 0, stderrData = [], stderrLength = 0;
        process.stdout.on('data', function(data) { stdoutData.push(data); stdoutLength += data.length; });
        process.stderr.on('data', function(data) { stderrData.push(data); stderrLength += data.length; });

        process.on('close', function(code)
        {
            if(code !== 0)
            {
                console.warn('Child process exited with code ' + code);
            } // end if

            res.set('X-Exit-Code', code);
            if(stderrLength > 0)
            {
                var errorMessage = Buffer.concat(stderrData, stderrLength);
                console.warn('Returning error due to stderr output:');
                console.warn(errorMessage.toString());
                res.status(500).send(errorMessage);
            }
            else
            {
                res.status(200).send(Buffer.concat(stdoutData, stdoutLength));
            } // end if
        });
    }
    else
    {
        res.status(400).send(unknownFilterMsg({ filterName: req.params.filterName, filters: filters }));
    } // end if
});

var server = app.listen(config.port || 3000, function()
{
    address = server.address();

    usage = usageMsg({ address: address, filters: filters });

    console.log('%s listening at http://%s:%s', package.name, address.address, address.port);
});
