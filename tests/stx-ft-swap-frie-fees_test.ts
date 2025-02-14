import {
  Clarinet,
  Tx,
  Chain,
  Account,
  types,
  assertEquals,
  assertObjectMatch,
} from "../src/deps.ts";

Clarinet.test({
  name: "User can cancel stx-ft swap after 100 blocks",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet_1 = accounts.get("wallet_1")!;
    const wallet_2 = accounts.get("wallet_2")!;
    const ustx = 1_000_000;
    const amountFt = 10;

    let block = chain.mineBlock([
      Tx.contractCall(
        "fun-token",
        "mint",
        [types.uint(20_000)],
        wallet_1.address
      ),
      Tx.contractCall(
        "stx-ft-swap",
        "create-swap",
        [
          types.uint(ustx),
          types.uint(amountFt),
          types.some(types.principal(wallet_2.address)),
          types.principal(deployer.address + "." + "fun-token"),
          types.principal(deployer.address + "." + "fixed-frie-fees"),
        ],
        wallet_1.address
      ),
    ]);

    block.receipts[0].result.expectOk().expectBool(true);
    const id = 0;
    block.receipts[1].result.expectOk().expectUint(id);
    assertObjectMatch(block.receipts[1].events[0].ft_transfer_event, {
      sender: wallet_1.address,
      amount: `10000`,
    });
    assertObjectMatch(block.receipts[1].events[2].stx_transfer_event, {
      sender: wallet_1.address,
      amount: `${ustx}`,
    });

    chain.mineEmptyBlock(99);

    block = chain.mineBlock([
      Tx.contractCall(
        "stx-ft-swap",
        "cancel",
        [
          types.uint(id),
          types.principal(deployer.address + "." + "fun-token"),
          types.principal(deployer.address + "." + "fixed-frie-fees"),
        ],
        wallet_1.address
      ),
    ]);
    // too early
    block.receipts[0].result.expectErr().expectUint(4);

    block = chain.mineBlock([
      Tx.contractCall(
        "stx-ft-swap",
        "cancel",
        [
          types.uint(id),
          types.principal(deployer.address + "." + "fun-token"),
          types.principal(deployer.address + "." + "fixed-frie-fees"),
        ],
        wallet_2.address
      ),
    ]);
    block.receipts[0].result.expectOk();
    assertObjectMatch(block.receipts[0].events[0].ft_transfer_event, {
      recipient: wallet_2.address, // user 2 is rewarded with the fees
      amount: `10000`,
    });

    assertObjectMatch(block.receipts[0].events[2].stx_transfer_event, {
      recipient: wallet_1.address, // user 1 receives the stxs
      amount: `${ustx}`,
    });
  },
});

Clarinet.test({
  name: "User can submit ft",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet_1 = accounts.get("wallet_1")!;
    const wallet_2 = accounts.get("wallet_2")!;
    const wallet_3 = accounts.get("wallet_3")!;
    const ustx = 1_000_000;
    const amountFt = 10;

    let block = chain.mineBlock([
      Tx.contractCall(
        "fun-token",
        "mint",
        [types.uint(20_000)],
        wallet_1.address
      ),
      Tx.contractCall(
        "stx-ft-swap",
        "create-swap",
        [
          types.uint(ustx),
          types.uint(amountFt),
          types.some(types.principal(wallet_2.address)),
          types.principal(deployer.address + "." + "fun-token"),
          types.principal(deployer.address + "." + "fixed-frie-fees"),
        ],
        wallet_1.address
      ),
    ]);

    block.receipts[0].result.expectOk();
    const id = 0;
    block.receipts[1].result.expectOk().expectUint(id);
    assertObjectMatch(block.receipts[1].events[0].ft_transfer_event, {
      sender: wallet_1.address,
      amount: `10000`,
    });

    assertObjectMatch(block.receipts[1].events[2].stx_transfer_event, {
      sender: wallet_1.address,
      amount: `${ustx}`,
    });

    block = chain.mineBlock([
      Tx.contractCall(
        "stx-ft-swap",
        "submit-swap",
        [
          types.uint(id),
          types.principal(deployer.address + "." + "fun-token"),
          types.principal(deployer.address + "." + "fixed-frie-fees"),
        ],
        wallet_3.address
      ),
    ]);

    block.receipts[0].result.expectErr().expectUint(9); // invalid stx receiver, can only be called by seller

    block = chain.mineBlock([
      Tx.contractCall(
        "stx-ft-swap",
        "submit-swap",
        [
          types.uint(id),
          types.principal(deployer.address + "." + "fun-token"),
          types.principal(deployer.address + "." + "fixed-frie-fees"),
        ],
        wallet_2.address
      ),
    ]);

    block.receipts[0].result.expectOk().expectBool(true);
    assertObjectMatch(block.receipts[0].events[0].ft_transfer_event, {
      recipient: deployer.address,
      amount: `10000`,
    });
    assertObjectMatch(block.receipts[0].events[2].ft_transfer_event, {
      recipient: wallet_1.address,
      amount: `${amountFt}`,
    });

    assertObjectMatch(block.receipts[0].events[4].stx_transfer_event, {
      recipient: wallet_2.address,
      amount: `${ustx}`,
    });
  },
});
