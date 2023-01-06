import Main from './main.js';
import template from './template.html';
window.addEventListener('load', function() {
    document.body.innerHTML = template;
    const main = new Main();
    window.addEventListener('resize', function() {
        main.resize();
    });
});
