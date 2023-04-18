import { indexerClient, algodClient, FAIRMARKET_APP, user, bid_ins, bid_outs } from "./global"
import algosdk from "algosdk";

function array_to_map(bids_array) {
    const bids_map = {}
    for (const bid of bids_array) {
        bids_map[bid.id] = bid
    }
    return bids_map
}

export async function get_in_bids() {
        // const transactionInfo = await indexerClient
    //     .searchForTransactions()
    //     .txid("QPDRSHL44EU3WMLZKUD7QLMECWJ3HNKOJYQHSEPJIHLUVYN3CG6Q")
    //     .do();
    const transactionInfo = await indexerClient
        .searchForTransactions()
        .minRound(29186779)
        .applicationID(FAIRMARKET_APP)
        .txType("appl")
        .notePrefix(btoa(`${user}.`))
        .do();
    console.log(transactionInfo);
    const bid_ins_array = await get_bids(transactionInfo);
    bid_ins = array_to_map(bid_ins_array)
    return bid_ins;
}

export async function get_out_bids() {
    const transactionInfo = await indexerClient
        .searchForTransactions()
        .minRound(29186779)
        .applicationID(FAIRMARKET_APP)
        .address(user)
        .addressRole("sender")
        .txType("appl")
        .do();
    console.log(transactionInfo);
    const bid_outs_array = await get_bids(transactionInfo);
    bid_outs = array_to_map(bid_outs_array)
    return bid_outs;
}

async function get_bids(transactionInfo) {
    let bids = []
    for (const txn of transactionInfo.transactions) {
        // const txn = transactionInfo.transactions[0]
        // console.log("txn", txn)
        try {
            const bid = await bid_from_txn(txn)
            bids.push(bid)
        } catch (e) {
            console.error(e)
        }
    }
    console.log(bids);
    return bids;
}

async function bid_from_txn(txn) {
    // console.log(txn)
    // console.log(txn["application-transaction"])
    // console.log(txn["application-transaction"]["application-args"])
    const args = txn["application-transaction"]["application-args"];
    const bid_id = args[args.length - 1];
    console.log("bid_id", bid_id)
    const bid_id_uint8 = new Uint8Array(atob(bid_id).split("").map(function (c) { return c.charCodeAt(0); }));
    console.log("bid_id_uint8", bid_id_uint8)

    const boxResponse = await algodClient.getApplicationBoxByName(FAIRMARKET_APP, bid_id_uint8).do();
    const bid_uint8 = boxResponse.value;
    console.log("bid_uint8", bid_uint8)

    const A = algosdk.encodeAddress(bid_uint8.slice(0, 32))
    const B = algosdk.encodeAddress(bid_uint8.slice(32, 64))
    console.log("A", A)
    console.log("B", B)

    const currency_id = algosdk.bytesToBigInt(bid_uint8.slice(64, 72))
    console.log("currency_id", currency_id)
    const currency_amount = algosdk.bytesToBigInt(bid_uint8.slice(72, 80))
    console.log("currency_amount", currency_amount)

    const fx_n = algosdk.bytesToBigInt(bid_uint8.slice(80, 88))
    console.log("fx_n", fx_n)
    const fx_d = algosdk.bytesToBigInt(bid_uint8.slice(88, 96))
    console.log("fx_d", fx_d)

    const type = String.fromCharCode.apply(null, bid_uint8.slice(96, 97));
    console.log("type", type)

    const time = algosdk.bytesToBigInt(bid_uint8.slice(97, 105))
    console.log("time", time)

    const data = String.fromCharCode.apply(null, bid_uint8.slice(105, bid_uint8.length))
    console.log("data", data)

    return {
        id: bid_id,
        A,
        B,
        currency_id,
        currency_amount,
        fx_n,
        fx_d,
        type,
        time,
        data,
    }
}