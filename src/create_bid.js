// goal app call --from $A --app-id $FX_APP --foreign-app $FX_LP_APP --foreign-asset $CURRENCY_ID --app-account $FX_LP_ACCOUNT --out $TXNS_DIR/FX.txn
// goal clerk send --from $A --to $FAIRMARKET_ACCOUNT --amount 268900 --out $TXNS_DIR/algo_send.txn
// goal app call --from $A --app-id $FAIRMARKET_APP --foreign-asset $CURRENCY_ID --app-arg "str:create_bid" --app-arg "addr:$B" --app-arg $BID_ID --box $BID_ID --box "addr:$B" --note $B.$NOTE_0 --out $TXNS_DIR/app_call.txn --fee 2000
// goal asset send --from $A --to $FAIRMARKET_ACCOUNT --amount $CURRENCY_AMOUNT --assetid $CURRENCY_ID --out $TXNS_DIR/asset_send.txn
// BID_ID = hash($A$B$CURRENCY_ID$CURRENCY_AMOUNT$NOTE)

import algosdk from "algosdk"
import { sign_and_send, user, algod, FAIRMARKET_ACCOUNT, FAIRMARKET_APP, SEND_ALGO_AMOUNT, FX_APP, FX_LP_ACCOUNT, FX_LP_APP, peraWallet, uint8ArrayToBase64, b64_to_uint8array } from "./global.js"
import { sha512_256 } from "js-sha512"

export function send(B, currency_id, currency_amount, data) {
    console.log("send", peraWallet.isConnected)
    return create_bid(user, B, currency_id, currency_amount, data)
}

function calc_bid_id(A, B, currency_id, currency_amount, data) {
    const A_addr = algosdk.decodeAddress(A)
    console.log(A_addr.publicKey)
    const B_addr = algosdk.decodeAddress(B)
    console.log(B_addr.publicKey)
    const currency_id_bytes = algosdk.bigIntToBytes(currency_id, 8)
    console.log(currency_id_bytes)
    const currency_amount_bytes = algosdk.bigIntToBytes(currency_amount, 8)
    console.log(currency_amount_bytes)
    const enc = new TextEncoder()
    const data_bytes = enc.encode(data)
    console.log(data_bytes)
    const all_bytes = [...A_addr.publicKey, ...B_addr.publicKey, ...currency_id_bytes, ...currency_amount_bytes, ...data_bytes]
    console.log(all_bytes)
    const bid_id_uint8 = new Uint8Array(sha512_256.array(all_bytes))
    console.log(bid_id_uint8)
    // const bid_id_b64 = await uint8ArrayToBase64(bid_id_uint8)
    // console.log(bid_id_b64)
    return bid_id_uint8
}

async function create_bid(A, B, currency_id, currency_amount, data) {
    console.log("create_bid", A, B, currency_id, currency_amount, data)

    const suggestedParams = await algod.getTransactionParams().do()
    suggestedParams.flatFee = true
    suggestedParams.fee = 0

    const FX_txn_obj = {
        from: A,
        appIndex: FX_APP,
        foreignApps: [FX_LP_APP],
        foreignAssets: [currency_id],
        suggestedParams: suggestedParams,
    }
    const FX_lp_account = FX_LP_ACCOUNT[currency_id]
    if (FX_lp_account) FX_txn_obj.accounts = [FX_lp_account]
    const FX_txn = algosdk.makeApplicationCallTxnFromObject(FX_txn_obj)
    console.log("FX_txn", FX_txn)

    const algo_send_txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        from: A,
        to: FAIRMARKET_ACCOUNT,
        amount: SEND_ALGO_AMOUNT,
        suggestedParams: suggestedParams,
    })
    console.log("algo_send", algo_send_txn)

    const encoder = new TextEncoder()
    const api_cmd_uint8 = encoder.encode("create_bid")
    const B_uint8 = algosdk.decodeAddress(B).publicKey
    const bid_id_uint8 = calc_bid_id(A, B, currency_id, currency_amount, data)
    const box0 = { appIndex: FAIRMARKET_APP, name: bid_id_uint8 }
    const box1 = { appIndex: FAIRMARKET_APP, name: B_uint8 }
    
    const suggestedParamsAppCall = { ...suggestedParams }
    suggestedParamsAppCall.flatFee = true
    suggestedParamsAppCall.fee = 5000

    const note1 = `${B}.`
    const note1_bytes = encoder.encode(note1)
    const note2_bytes = bid_id_uint8
    const note3 = `.${data}`
    const note3_bytes = encoder.encode(note3)
    const note_bytes = new Uint8Array([...note1_bytes, ...note2_bytes, ...note3_bytes])
    
    const app_call_txn = algosdk.makeApplicationCallTxnFromObject({
        from: A,
        appIndex: FAIRMARKET_APP,
        foreignAssets: [currency_id],
        appArgs: [api_cmd_uint8, B_uint8, bid_id_uint8],
        boxes: [box0, box1],
        note: note_bytes,
        suggestedParams: suggestedParamsAppCall,
    })
    console.log("app_call", app_call_txn)

    const asset_send_txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        from: A,
        to: FAIRMARKET_ACCOUNT,
        assetIndex: currency_id,
        amount: currency_amount,
        suggestedParams: suggestedParams,
    })
    console.log("asset_send", asset_send_txn)

    return sign_and_send([FX_txn, algo_send_txn, app_call_txn, asset_send_txn], A)
}