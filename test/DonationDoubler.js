const DonationDoubler = artifacts.require('../contracts/DonationDoubler.sol');
const GivethCampaign = artifacts.require('../contracts/GivethCampaign.sol');
const Token = artifacts.require("../contracts/MiniMeToken.sol");
const TokenFactory = artifacts.require("MiniMeTokenFactory")
const Vault = artifacts.require("../contracts/Vault.sol");

const filterCoverageTopics = require("./helpers/filterCoverageTopics.js");
const days = require("./helpers/days.js");
const hours = require("./helpers/hours.js");
const wei = require("./helpers/wei.js");
const assertJump = require("./helpers/assertJump.js");
const timeTravel = require('./helpers/timeTravel.js');

// tokenName: "MiniMe Test Token",
//            decimalUnits: 18,
//            tokenSymbol: "MMT",
//            escapeCaller,
//            escapeDestination,
//            absoluteMinTimeLock: 86400,
//            timeLock: 86400 * 2,
//            securityGuard,
//            maxSecurityGuardDelay: 86400 * 21,
        // address _tokenFactory,
        // address _parentToken,
        // uint _parentSnapShotBlock,
        // string _tokenName,
        // uint8 _decimalUnits,
        // string _tokenSymbol,
        // bool _transfersEnabled
contract("Donation_Doubler", (accounts) => {
    const {
        0: owner,
        1: escapeHatchCaller,
        2: escapeHatchDestination,
        3: securityGuard,
        4: guest,
        5: spender,
        // 6: mockToken,
        // 7: mockVault
    } = accounts;
    let dblr;
    let campaign;
    let now;
    let tokenFactory;
    let token;
    let vault;
    beforeEach( async () => {
        
        now = (await web3.eth.getBlock("latest")).timestamp
        // Campaign _beneficiary,
        // address _escapeHatchCaller,
        // address _escapeHatchDestination
        // campaign =  ¡

        // it("Get Now", (done) => {
        //     ethConnector.web3.eth.getBlock("latest", (err, block) => {
        //         assert.ifError(err);
        //         now = block.timestamp;
        //         done();
        //     });
        // uint _startFundingTime,
        // uint _endFundingTime,
        // uint _maximumFunding,
        // address _vaultAddress,
        // address _tokenAddress
        tokenFactory = await TokenFactory.new( //  
        )
        token = await Token.new(
            tokenFactory.address,
            0,
            0,
            "Minime Test Token",// name
            18,// decimals
            "MMT", // symbol
            true // transfers enabled
        )
        vault = await Vault.new(
            token.address,
            escapeHatchCaller,
            escapeHatchDestination,
            86400, // absoluteMinTimeLock
            86400 * 2, // timeLock
            securityGuard,
            86400 * 21, // maxSecurityGuardDelay
        )
        campaign = await GivethCampaign.new(
            now,
            now + days(365),
            web3.toWei(10000), // 10000 ether for beta
            vault.address, //vaultAddress
            token.address 
        )
        dblr = await DonationDoubler.new(
            // deploy a GivethCampaign here
            campaign.address,
            escapeHatchCaller,
            escapeHatchDestination
        )
    });

    it('Should initialize correctly', async () => {
        let benfic = await dblr.beneficiary()
        let Campaign = GivethCampaign.at(benfic)
        let T = Token.at(await Campaign.tokenContract())
        assert.equal(benfic, campaign.address);
        assert.equal(await Campaign.vaultAddress(), vault.address);
        assert.equal(await Campaign.tokenContract(), token.address);
    });

    it('Should deposit ETH correctly', async () => {
        let {event, args} = (await dblr.depositETH({value: wei(10000), from: owner})).logs[0]
        assert.equal(event, "DonationDeposited4Doubling");
        assert.equal(args.amount.toNumber(), 10000);
        assert.equal(args.sender, owner);
    });

    it('Should deposit ETH correctly', async () => {
        let {event, args} = (await dblr.depositETH({value: wei(10000), from: owner})).logs[0]
        assert.equal(event, "DonationDeposited4Doubling");
        assert.equal(args.amount.toNumber(), 10000);
        assert.equal(args.sender, owner);
    });

    it('Should double', async () => {
        await dblr.depositETH({value: wei(10000), from: owner})
        await dblr.depositETH({value: wei(10000), from: owner})
        let benfic = await dblr.beneficiary()
        let Campaign = GivethCampaign.at(benfic)
        await timeTravel(days(2))

        let now = web3.eth.getBlock("latest").timestamp
        assert.isTrue(
            now > (await Campaign.startFundingTime.call()).toNumber()
        );        

        let T = Token.at(await Campaign.tokenContract())
        assert.isTrue(
            now < (await Campaign.endFundingTime.call()).toNumber()
        );        
        assert.isTrue(
            await Campaign.tokenContract.call() !== 0
        );        

        assert.isTrue(
            await Campaign.totalCollected.call() < await Campaign.maximumFunding.call()
        );
        //TODO: INVALID OPCODE
        // let res = await Campaign.proxyPayment(owner, {value: wei(10000)})
        // let res = await Campaign.send({value: wei(10000)})
        // let res = await web3.eth.sendTransaction({from:owner, to: benfic, value: wei(10000)})
    });

    // it('Should double', async () => {
    //     await dblr.depositETH({value: wei(10000), from: owner})
    //     await dblr.depositETH({value: wei(10000), from: owner})
    //     let benfic = await dblr.beneficiary()
    //     let Campaign = GivethCampaign.at(benfic)

    //     await timeTravel(days(2))

    //     let now = web3.eth.getBlock("latest").timestamp
    //     let T = Token.at(await Campaign.tokenContract())

    //     assert.isTrue(
    //         now > (await Campaign.startFundingTime.call()).toNumber()
    //     );        

    //     assert.isTrue(
    //         now < (await Campaign.endFundingTime.call()).toNumber()
    //     );        
    //     assert.isTrue(
    //         await Campaign.tokenContract.call() !== 0
    //     );        

    //     assert.isTrue(
    //         await Campaign.totalCollected.call() < await Campaign.maximumFunding.call()
    //     );

    //     // FIX: invalid opcode
    //     let {event, args} = (await Campaign.proxyPayment(owner, {value: wei(10000), from: owner })).logs[0]

    //     assert.equal(event, "DonationDoubled");
    //     assert.equal(args.amount.toNumber(), 20000);
    //     assert.equal(args.sender, owner);
    // });    

    // it('Should double', async () => {
    //     await dblr.depositETH({value: wei(10000), from: owner})
    //     await dblr.depositETH({value: wei(10000), from: owner})
    //     await dblr.depositETH({value: wei(10000), from: owner})
    //     let benfic = await dblr.beneficiary()
    //     let Campaign = GivethCampaign.at(benfic)

    //     await timeTravel(days(2))

    //     let now = web3.eth.getBlock("latest").timestamp
    //     let T = Token.at(await Campaign.tokenContract())

    //     assert.isTrue(
    //         now > (await Campaign.startFundingTime.call()).toNumber()
    //     );        

    //     assert.isTrue(
    //         now < (await Campaign.endFundingTime.call()).toNumber()
    //     );        
    //     assert.isTrue(
    //         await Campaign.tokenContract.call() !== 0
    //     );        

    //     assert.isTrue(
    //         await Campaign.totalCollected.call() < await Campaign.maximumFunding.call()
    //     );

    //     let {event, args} = (await Campaign.proxyPayment(owner, {value: wei(20000), from: owner })).logs[0]

    //     assert.equal(event, "DonationSentButNotDoubled");
    //     assert.equal(args.amount.toNumber(), 30000);
    //     assert.equal(args.sender, owner);

    // });
})