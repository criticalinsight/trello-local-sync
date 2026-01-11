/* @refresh reload */
import { render } from 'solid-js/web';
import { onMount } from 'solid-js';
import { Board } from './components/Board';
import { initStore } from './store';
import './index.css';

const App = () => {
    onMount(async () => {
        await initStore();
    });

    return <Board />;
};

const root = document.getElementById('root');
if (root) {
    render(() => <App />, root);
}
