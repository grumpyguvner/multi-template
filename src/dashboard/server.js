import express from 'express';
import fs from 'node:fs';
import Handlebars from 'handlebars';

const app = express();
const __dirname = import.meta.dirname;

app.use(express.static(__dirname + '/themes/ford/public'));
app.use(express.static(__dirname + '/themes/theme1/public'));
app.use(express.static(__dirname + '/public'));

// Set up Handlebars as the view engine
app.set('defaultLayout', 'default');
app.set('views', __dirname + '/views/');
app.set('themes', __dirname + '/themes/');
app.set('ext', '.hbs');
app.set('layouts', 'layouts');
app.set('partials', 'partials');

// Fetch source file contents
const sourceContent = (template, theme) => {
	if (theme) {
		let templatePath = template.replace(
			app.get('views'),
			`${app.get('themes')}${theme}/`
		);
		if (fs.existsSync(templatePath)) {
			template = templatePath;
		}
	}
	// Read the source of the template file
	return fs.readFileSync(template, 'utf8');
};

// Set up theming middleware
app.engine('.hbs', (view, options, callback) => {
	const theme = options?.theme ?? false;
	const layout =
		options?.layout ??
		options?.settings?.defaultLayout ??
		app.get('defaultLayout');
	let source = '{{{body}}}';
	if (
		layout !== 'false' &&
		layout !== 'none' &&
		layout !== 'null' &&
		layout
	) {
		source = sourceContent(
			`${app.get('views')}${app.get('layouts')}/${layout}${app.get(
				'ext'
			)}`,
			theme
		);
	}
	const viewSource = sourceContent(view, theme);
	source = source.replace('{{{body}}}', viewSource);

	// Check the source for any partials block(s) and replace them with themed partials
	const layoutPartials = source.match(/{{>.*}}/g);
	if (layoutPartials) {
		layoutPartials.forEach((partial) => {
			const partialName = partial
				.replace('{{>', '')
				.replace('}}', '')
				.trim();
			const partialSource = sourceContent(
				`${app.get('views')}${app.get(
					'partials'
				)}/${partialName}${app.get('ext')}`,
				theme
			);
			source = source.replace(partial, partialSource);
		});
	}

	// Compile the Handlebars template
	const template = Handlebars.compile(source);
	// Render the template
	const html = template(options);
	// Return the rendered HTML
	return callback(null, html);
});
app.set('view engine', '.hbs');

// Define routes
app.get('/', (req, res) => {
	// Check if the theme is specified in the query string, this needs to
	// be changed to use the theme specified by the host header or channel
	// settings. Also, need to use a fallback theme if the specified theme
	// does not exist.
	res.render('home', {
		title: "Nostrum: Latin for 'Ours'",
		theme: req.query?.theme ?? false,
		layout: req.query?.layout,
	});
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`Server started on port ${PORT}`);
});
