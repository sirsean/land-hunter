import React from 'react';
import { Provider, useSelector } from 'react-redux';
import { createSlice, configureStore } from '@reduxjs/toolkit';
import sortBy from 'sort-by';
import './App.css';

const API_URL = 'https://liquidlands-api.sirsean.workers.dev';
const APP_VERSION = '10155a1a1';

const slice = createSlice({
    name: 'land-hunter',
    initialState: {
        error: null,
        factions: null,
        currentFaction: null,
        lands: null,
    },
    reducers: {
        setError: (state, action) => {
            state.error = action.payload;
        },
        setFactions: (state, action) => {
            state.factions = action.payload;
        },
        setCurrentFaction: (state, action) => {
            state.currentFaction = action.payload;
            state.lands = null;
        },
        setLands: (state, action) => {
            state.lands = action.payload;
        },
    },
});

const {
    setError,
    setFactions,
    setCurrentFaction,
    setLands,
} = slice.actions;
const store = configureStore({
    reducer: slice.reducer,
});

const selectError = state => state.error;
const selectFactions = state => state.factions;
const selectCurrentFaction = state => state.currentFaction;
const selectLands = state => state.lands;

async function fetchFactions() {
    return fetch(`${API_URL}/controller`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            controller: 'Bundles.Factions',
            debug: true,
            fields: {
                app_version: APP_VERSION,
            },
        }),
    }).then(r => r.json())
        .then(r => {
            store.dispatch(setError(r.b));
            return r.d.factions;
        })
        .then(factions => {
            store.dispatch(setFactions(factions));
        });
}

function buildLand(now, tile, bag, nft) {
    const started = new Date(tile.started + 'Z');
    const ms = now.getTime() - started.getTime();
    const bricksPerDay = tile.bricks_per_day;
    const hours = (ms / 1000 / 60 / 60);
    const days = (hours / 24);
    const available = (bricksPerDay * days);
    const reward = (available / 3.7);
    const defense = bag.defence_bonus;
    return {
        landId: tile.tile_id,
        hours,
        bricksPerDay,
        available,
        reward,
        defense,
        faction: nft.collection_name,
        country: tile.iso,
    };
}

async function fetchLand(landId) {
    return fetch(`${API_URL}/controller`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            controller: 'Land.Get',
            debug: true,
            fields: {
                tile_id: landId,
                app_version: APP_VERSION,
                exp_filter: 'best',
                open_map_id: 0,
            },
        }),
    }).then(r => r.json()).then(r => {
        store.dispatch(setError(r.b));
        return buildLand(new Date(r.d.now), r.d.land.tile, r.d.land.bag, r.d.land.nft);
    }).catch(e => {
        //console.log(e);
        return null;
    });
}

async function fetchFactionLands(factionAddr) {
    return fetch(`${API_URL}/controller`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            controller: 'Bundles.Faction',
            debug: true,
            fields: {
                address: factionAddr,
                app_version: APP_VERSION,
                exp_filter: 'all',
                network: '1',
                token_id: '',
            },
        }),
    }).then(r => r.json()).then(r => {
        store.dispatch(setError(r.b));
        return Promise.all(r.d.explorers.filter(e => e.tile).map(e => fetchLand(e.tile.tile_id)));
    }).then(lands => {
        store.dispatch(setLands(lands.sort(sortBy('-reward'))));
    }).catch(e => {
        console.log(e);
        return null;
    });
}

function LandRow({ land }) {
    const href = `https://liquidlands.io/land/${land.landId}`;
    return (
        <tr>
            <td className="left"><a href={href} target="_blank" rel="noreferrer">{land.landId}</a></td>
            <td>{land.country}</td>
            <td>{land.reward.toFixed(6)}</td>
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
                        <th>Country</th>
                        <th>Raid Reward</th>
                        <th>Defense</th>
                    </tr>
                </thead>
                <tbody>
                    {lands.map(l => <LandRow key={l.landId} land={l} />)}
                </tbody>
            </table>
        );
    }
}

function CurrentFaction() {
    const faction = useSelector(selectCurrentFaction);
    if (faction) {
        const clickBack = (e) => {
            store.dispatch(setCurrentFaction(null));
        }
        return (
            <div>
                <div><button onClick={clickBack}>Back</button></div>
                <h1>{faction.name}</h1>
                <LandsList />
            </div>
        );
    }
}

function FactionRow({ faction }) {
    const onClick = (e) => {
        store.dispatch(setCurrentFaction(faction));
        fetchFactionLands(faction.address);
    }
    return (
        <tr>
            <td><img src={faction.cover_preview} alt={faction.name} /></td>
            <td>{faction.name}</td>
            <td>{faction.gen_land}</td>
            <td>{faction.gen_bricks}</td>
            <td><button onClick={onClick}>Hunt</button></td>
        </tr>
    );
}

function FactionsList() {
    const factions = useSelector(selectFactions);
    if (factions) {
        return (
            <table className="factions">
                <thead>
                    <tr>
                        <th></th>
                        <th>Name</th>
                        <th>Land</th>
                        <th>Bricks</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {factions.map(f => <FactionRow key={f.address} faction={f} />)}
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
    const currentFaction = useSelector(selectCurrentFaction);
    if (currentFaction) {
        return (
            <CurrentFaction />
        );
    } else {
        return (
            <FactionsList />
        );
    }
}

function App() {
    fetchFactions();
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
