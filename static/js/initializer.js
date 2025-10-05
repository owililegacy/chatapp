document.addEventListener('DOMContentLoaded', function() {
    for (const item of [ "connector", "base", "theme_handler", "utils"]) {
        addScripts(item);
    }


});

function addScripts(script) {
    const script_el = document.createElement('script');
    script_el.type = "text/javascript"
    script_el.src = `static/js/${script}.js`;
    script_el.async = true; // Optional: load the script asynchronously
    document.body.appendChild(script_el);
    console.log(`Added ${script} script`);
}
