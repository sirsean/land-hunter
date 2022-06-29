import React from 'react';
import { Provider, useSelector } from 'react-redux';
import { createSlice, configureStore } from '@reduxjs/toolkit';
import sortBy from 'sort-by';
import RateLimiter from 'promise-rate-limiter';
import './App.css';

const API_URL = 'https://liquidlands-api.sirsean.workers.dev';
const APP_VERSION = '10184a1a1';

const ALLIED_FACTION_IDS = new Set([
    199, // Homie G
    249, // Wandernauts
    266, // Cryptorunnerso
    240, // Bored Ape Pixel Club
    243, // Bored 2 Death Club
    253, // Battle Bunnies
    239, // TrapMonkie
    349, // Northern Guilds
]);

const slice = createSlice({
    name: 'land-hunter',
    initialState: {
        error: null,
        lands: null,
    },
    reducers: {
        setError: (state, action) => {
            state.error = action.payload;
        },
        setLands: (state, action) => {
            state.lands = action.payload;
        },
        updateLand: (state, action) => {
            const { tileId, reward, defense } = action.payload;
            if (tileId) {
                if (reward !== null) {
                    state.lands[tileId].reward = reward;
                }
                if (defense !== null) {
                    state.lands[tileId].defense = defense;
                }
            }
        },
    },
});

const {
    setError,
    setLands,
    updateLand,
} = slice.actions;
const store = configureStore({
    reducer: slice.reducer,
});

const selectError = state => state.error;
const selectLands = state => {
    if (state.lands) {
        return Object.keys(state.lands).map(landId => state.lands[landId]).sort(sortBy('-reward','-maxReward'));
    } else {
        return [];
    }
};

function calculateReward(bricksPerDay, timeString) {
    if (timeString === null) {
        return 0;
    } else {
        const time = new Date(timeString.replace(/\.\d+$/, '.000') + 'Z');
        const now = new Date();
        const ms = now.getTime() - time.getTime();
        const hours = (ms / 1000 / 60 / 60);
        const days = (hours / 24);
        return ((bricksPerDay * days) / 3.7);
    }
}

async function fetchLand(tileId) {
    return fetch(`${API_URL}/controller`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            controller: 'Land.Get',
            debug: true,
            fields: {
                tile_id: tileId,
                app_version: APP_VERSION,
                exp_filter: 'best',
                open_map_id: 0,
            },
        }),
    }).then(r => r.json()).then(r => {
        store.dispatch(setError(r.b));
        const land = r.d.land;
        if (land.bag && land.tile) {
            store.dispatch(updateLand({
                tileId: tileId,
                defense: land.bag.defence_bonus,
                reward: calculateReward(land.tile.bricks_per_day, land.tile.started),
            }));
        }
    }).catch(e => {
        console.error(e);
    });
}

const fetchLandLimiter = new RateLimiter([
    { limit: 10, duration: 1000 },
    { limit: 100, duration: 60000 },
], fetchLand);

async function fetchLands() {
    return fetch(`${API_URL}/raw/land`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    }).then(r => r.json())
    .then(coll => coll.map(([tileId, mapId, factionId, guardedAt, bricksPerDay]) => {
        const maxReward = calculateReward(bricksPerDay, guardedAt);
        return { tileId, mapId, factionId, bricksPerDay, guardedAt, maxReward,
            reward: null,
            defense: null,
        };
    })).then(lands => {
        return lands
            .filter(l => (!ALLIED_FACTION_IDS.has(l.factionId)))
            .filter(l => (l.maxReward >= 0.05))
            //.splice(0, 5)
    }).then(lands => {
        const landMap = lands.reduce((acc, l) => {
            acc[l.tileId] = l;
            return acc;
        }, {});
        store.dispatch(setLands(landMap));
        (async () => {
            lands.forEach(async (l) => {
                await fetchLandLimiter.call(l.tileId, l.tileId);
            });
        })();
    }).catch(e => {
        console.error(e);
    });
}

function LandRow({ land }) {
    const href = `https://liquidlands.io/land/${land.tileId}`;
    return (
        <tr>
            <td className="left"><a href={href} target="_blank" rel="noreferrer">{land.tileId}</a></td>
            <td>{land.reward ? land.reward.toFixed(6) : ''}</td>
            <td>{land.defense}</td>
        </tr>
    );
}

function LandsList() {
    const lands = useSelector(selectLands);
    if (lands) {
        return (
            <table className="lands">
                <thead>
                    <tr>
                        <th className="left">Land</th>
                        <th>Raid Reward</th>
                        <th>Defense</th>
                    </tr>
                </thead>
                <tbody>
                    {lands.map(l => <LandRow key={l.tileId} land={l} />)}
                </tbody>
            </table>
        );
    }
}

function Error() {
    const msg = useSelector(selectError);
    if (msg && msg !== 'Success') {
        return (
            <div className="error">
                Error: ${msg} ... tell sirsean about it.
            </div>
        );
    }
}

function Main() {
    return <LandsList />;
}

function App() {
    fetchLands();
    return (
        <Provider store={store}>
            <div className="App">
                <Error />
                <Main />
            </div>
        </Provider>
    );
}

export default App;
