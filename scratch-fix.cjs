const fs = require('fs');

function patchFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace category
  content = content.replace(/fireEvent\.change\(screen\.getByLabelText\(\/category\/i\), \{ target: \{ value: '(.*?)' \} \}\);/g, 
    "fireEvent.click(screen.getByLabelText(/category/i)); fireEvent.click(document.querySelector('button[value=\"$1\"]'));");

  // Replace account (case insensitive label)
  content = content.replace(/fireEvent\.change\(screen\.getByLabelText\(\/account\/i\), \{ target: \{ value: '(.*?)' \} \}\);/g, 
    "fireEvent.click(screen.getByLabelText(/account/i)); fireEvent.click(document.querySelector('button[value=\"$1\"]'));");

  // Replace From/To
  content = content.replace(/fireEvent\.change\(screen\.getByLabelText\(\/\^From\/\), \{ target: \{ value: '(.*?)' \} \}\);/g, 
    "fireEvent.click(screen.getByLabelText(/^From/)); fireEvent.click(document.querySelector('button[value=\"$1\"]'));");
  
  content = content.replace(/fireEvent\.change\(screen\.getByLabelText\(\/\^To\/\), \{ target: \{ value: '(.*?)' \} \}\);/g, 
    "fireEvent.click(screen.getByLabelText(/^To/)); fireEvent.click(document.querySelector('button[value=\"$1\"]'));");

  // Replace Currency
  content = content.replace(/fireEvent\.change\(screen\.getByLabelText\('Currency'\), \{ target: \{ value: '(.*?)' \} \}\);/g, 
    "fireEvent.click(screen.getByLabelText('Currency')); fireEvent.click(document.querySelector('button[value=\"$1\"]'));");
    
  // Replace Trip
  content = content.replace(/fireEvent\.change\(screen\.getByLabelText\(\/trip\/i\), \{ target: \{ value: '(.*?)' \} \}\);/g, 
    "fireEvent.click(screen.getByLabelText(/trip/i)); fireEvent.click(document.querySelector('button[value=\"$1\"]'));");

  // Fix native <select> .options map call for Transfer tests
  content = content.replace(/const fromValues = \[\.\.\.screen\.getByLabelText\(\/\^From\/\)\.options\]\.map\(o => o\.value\);/g,
    "fireEvent.click(screen.getByLabelText(/^From/)); const fromValues = [...document.querySelectorAll('[role=\"dialog\"] button[value]')].map(b => b.value); fireEvent.click(document.querySelector('[role=\"dialog\"]'));");
    
  content = content.replace(/const toValues = \[\.\.\.screen\.getByLabelText\(\/\^To\/\)\.options\]\.map\(o => o\.value\);/g,
    "fireEvent.click(screen.getByLabelText(/^To/)); const toValues = [...document.querySelectorAll('[role=\"dialog\"] button[value]')].map(b => b.value); fireEvent.click(document.querySelector('[role=\"dialog\"]'));");

  fs.writeFileSync(filePath, content);
}

patchFile('src/where-it-went/components/TransactionForm.test.jsx');
patchFile('src/where-it-went/components/SubscriptionEditorModal.test.jsx');
