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
            0,
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
        let T = Token.at(token.address)
        await T.changeController(campaign.address)

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
        assert.equal((web3.eth.getBalance(dblr.address)).toNumber(), 10000);
    });

    it('Should double donation', async () => {
        let benfic = await dblr.beneficiary()
        let Campaign = GivethCampaign.at(benfic)

        await dblr.depositETH({value: wei(10000), from: owner})
        await timeTravel(days(2))

        let now = web3.eth.getBlock("latest").timestamp
        assert.isTrue(
            now > (await Campaign.startFundingTime.call()).toNumber()
        );        
        assert.isTrue(
            now < (await Campaign.endFundingTime.call()).toNumber()
        );        
        assert.isTrue(
            await Campaign.tokenContract.call() !== 0
        );        
        assert.isTrue(
            await Campaign.totalCollected.call() < await Campaign.maximumFunding.call()
        );

        const {event, args} = (await dblr.sendTransaction({value: wei(10000), gas: wei(1000000)})).logs[0]

        assert.equal((web3.eth.getBalance(dblr.address)).toNumber(), 0);
        assert.equal(event, "DonationDoubled");
        assert.equal(args.sender, owner);
        assert.equal(args.amount.toNumber(), 20000);

    });

    it('Should double the donation after fund is emptied and re-funded with new donations', async () => {
        await dblr.depositETH({value: wei(50000), from: owner})
        let benfic = await dblr.beneficiary()
        let Campaign = GivethCampaign.at(benfic)

        await timeTravel(days(2))

        let now = web3.eth.getBlock("latest").timestamp
        let T = Token.at(await Campaign.tokenContract())

        assert.isTrue(
            now > (await Campaign.startFundingTime.call()).toNumber()
        );        
        assert.isTrue(
            now < (await Campaign.endFundingTime.call()).toNumber()
        );        
        assert.isTrue(
            await Campaign.tokenContract.call() !== 0
        );        
        assert.isTrue(
            await Campaign.totalCollected.call() < await Campaign.maximumFunding.call()
        );

        const {event, args} = (await dblr.sendTransaction({value: wei(50000), gas: wei(1000000)})).logs[0]

        assert.equal((web3.eth.getBalance(dblr.address)).toNumber(), 0);
        assert.equal(event, "DonationDoubled");
        assert.equal(args.amount.toNumber(), 100000);
        assert.equal(args.sender, owner);

        await dblr.depositETH({value: wei(50000), from: owner});
        // local scope to allow declaring of {event, args} variables again
       {
            const {event, args} = (await dblr.sendTransaction({value: wei(50000), gas: wei(1000000)})).logs[0]

            assert.equal((web3.eth.getBalance(dblr.address)).toNumber(), 0);
            assert.equal(event, "DonationDoubled");
            assert.equal(args.amount.toNumber(), 100000);
            assert.equal(args.sender, owner);
        }

    });    

    it('Should send donation but not double if less than double donation is in the fund', async () => {
        await dblr.depositETH({value: wei(10000), from: owner})
        let benfic = await dblr.beneficiary()
        let Campaign = GivethCampaign.at(benfic)

        await timeTravel(days(2))

        let now = web3.eth.getBlock("latest").timestamp

        assert.isTrue(
            now > (await Campaign.startFundingTime.call()).toNumber()
        );        
        assert.isTrue(
            now < (await Campaign.endFundingTime.call()).toNumber()
        );        
        assert.isTrue(
            await Campaign.tokenContract.call() !== 0
        );        
        assert.isTrue(
            await Campaign.totalCollected.call() < await Campaign.maximumFunding.call()
        );
        
        assert.equal((web3.eth.getBalance(dblr.address)).toNumber(), 10000);

        const {event, args} = (await dblr.sendTransaction({value: wei(20000), gas: wei(1000000)})).logs[0]

        assert.equal((web3.eth.getBalance(dblr.address)).toNumber(), 0);
        assert.equal(event, "DonationSentButNotDoubled");
        assert.equal(args.amount.toNumber(), 30000);
        assert.equal(args.sender, owner);
    });

    it('Should send donation but not double if less than double donation is in the fund, after fund has been emptied', async () => {
        await dblr.depositETH({value: wei(10000), from: owner})
        let benfic = await dblr.beneficiary()
        let Campaign = GivethCampaign.at(benfic)

        await timeTravel(days(2))

        let now = web3.eth.getBlock("latest").timestamp

        assert.isTrue(
            now > (await Campaign.startFundingTime.call()).toNumber()
        );        
        assert.isTrue(
            now < (await Campaign.endFundingTime.call()).toNumber()
        );        
        assert.isTrue(
            await Campaign.tokenContract.call() !== 0
        );        
        assert.isTrue(
            await Campaign.totalCollected.call() < await Campaign.maximumFunding.call()
        );

        const {event, args} = (await dblr.sendTransaction({value: wei(20000), gas: wei(1000000)})).logs[0]

        assert.equal(event, "DonationSentButNotDoubled");
        assert.equal(args.amount.toNumber(), 30000);
        assert.equal(args.sender, owner);  

        await dblr.depositETH({value: wei(10000), from: owner})
        {
            const {event, args} = (await dblr.sendTransaction({value: wei(20000), gas: wei(1000000)})).logs[0]

            assert.equal((web3.eth.getBalance(dblr.address)).toNumber(), 0);
            assert.equal(event, "DonationSentButNotDoubled");
            assert.equal(args.amount.toNumber(), 30000);
            assert.equal(args.sender, owner);
        }
    });
})