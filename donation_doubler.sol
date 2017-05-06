pragma solidity ^0.4.10;


/*
    Copyright 2017, Vojtech Simetka

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/// @title Donation Doubler
/// @authors Vojtech Simetka, Jordi Baylina
/// @notice This contract is used to double a donation to a Giveth Campaign as
///  long as there is enough ether in this contract to do it. If not, the
///  donated value is just sent directly to designated Campaign with any ether
///  that may still be in this contract. The `msg.sender` doubling their
///  donation will receive twice the expected Campaign tokens and the Donor that
///  deposited the inital funds will not receive any donation tokens. 
///  WARNING: This contract only works for ether. A token based contract will be
///  developed in the future. Any tokens sent to this contract will be lost.


/// @dev `Owned` is a base level contract that assigns an `owner` that can be
///  later changed
contract Owned {
    /// @dev `owner` is the only address that can call a function with this
    /// modifier
    modifier onlyOwner { if (msg.sender != owner) throw; _; }

    address public owner;

    /// @notice The Constructor assigns the message sender to be `owner`
    function Owned() { owner = msg.sender;}

    /// @notice `owner` can step down and assign some other address to this role
    /// @param _newOwner The address of the new owner. 0x0 can be used to create
    ///  an unowned neutral vault, however that cannot be undone
    function changeOwner(address _newOwner) onlyOwner {
        owner = _newOwner;
        NewOwner(msg.sender, _newOwner);
    }

    event NewOwner(address indexed oldOwner, address indexed newOwner);
}
/// @dev `Escapable` is a base level contract built off of the `Owned`
///  contract that creates an escape hatch function to send its ether to
///  `escapeHatchDestination` when called by the `escapeHatchCaller` in the case that
///  something unexpected happens
contract Escapable is Owned {
    address public escapeHatchCaller;
    address public escapeHatchDestination;

    /// @notice The Constructor assigns the `escapeHatchDestination` and the
    ///  `escapeHatchCaller`
    /// @param _escapeHatchDestination The address of a safe location (usu a
    ///  Multisig) to send the ether held in this contract
    /// @param _escapeHatchCaller The address of a trusted account or contract to
    ///  call `escapeHatch()` to send the ether in this contract to the
    ///  `escapeHatchDestination` it would be ideal that `escapeHatchCaller` cannot move
    ///  funds out of `escapeHatchDestination`
    function Escapable(address _escapeHatchCaller, address _escapeHatchDestination) {
        escapeHatchCaller = _escapeHatchCaller;
        escapeHatchDestination = _escapeHatchDestination;
    }

    /// @dev The addresses preassigned the `escapeHatchCaller` role
    ///  is the only addresses that can call a function with this modifier
    modifier onlyEscapeHatchCallerOrOwner {
        if ((msg.sender != escapeHatchCaller)&&(msg.sender != owner))
            throw;
        _;
    }

    /// @notice The `escapeHatch()` should only be called as a last resort if a
    /// security issue is uncovered or something unexpected happened
    function escapeHatch() onlyEscapeHatchCallerOrOwner {
        uint total = this.balance;
        // Send the total balance of this contract to the `escapeHatchDestination`
        if (!escapeHatchDestination.send(total)) {
            throw;
        }
        EscapeHatchCalled(total);
    }
    /// @notice Changes the address assigned to call `escapeHatch()`
    /// @param _newEscapeHatchCaller The address of a trusted account or contract to
    ///  call `escapeHatch()` to send the ether in this contract to the
    ///  `escapeHatchDestination` it would be ideal that `escapeHatchCaller` cannot
    ///  move funds out of `escapeHatchDestination`
    function changeEscapeCaller(address _newEscapeHatchCaller) onlyEscapeHatchCallerOrOwner {
        escapeHatchCaller = _newEscapeHatchCaller;
    }

    event EscapeHatchCalled(uint amount);
}

/// @dev This is an empty contract to declare `proxyPayment()` to comply with
///  Giveth Campaigns 
contract Campaign {
    /// @notice `proxyPayment()` allows the caller to send ether to the Campaign and
    /// have the tokens created in an address of their choosing
    /// @param _owner The address that will hold the newly created tokens

    function proxyPayment(address _owner) payable returns(bool);
}

/// @dev Finally! The main contract which doubles the amount donated.
contract DonationDoubler is Escapable{
    Campaign public beneficiary; // expected to be a Giveth campaign

    /// @notice The Constructor assigns the `beneficiary`, the
    ///  `escapeHatchDestination` and the `escapeHatchCaller` as well as deploys
    ///  the contract to the blockchain (obviously)
    /// @param _beneficiary The address of the Campaign controller for the Campaign
    /// @param _escapeHatchDestination The address of a safe location (usually a
    ///  Multisig) to send the ether held in this contract
    /// @param _escapeHatchCaller The address of a trusted account or contract
    ///  to call `escapeHatch()` to send the ether in this contract to the 
    ///  `escapeHatchDestination` it would be ideal that `escapeHatchCaller`
    ///  cannot move funds out of `escapeHatchDestination`
    function DonationDoubler(
            Campaign _beneficiary,
            address _escapeHatchCaller,
            address _escapeHatchDestination
        )
        Escapable(_escapeHatchCaller, _escapeHatchDestination)
    {
        beneficiary = _beneficiary;
    }

    /// @notice Simple function to deposit more ETH to Double Donations
    function depositETH() payable {
        DonationDeposited4Doubling(msg.sender, msg.value);
    }

    /// @notice Donate ETH to the `beneficiary`, and if there is enough in the 
    ///  contract double it. The `msg.sender` is rewarded with Campaign tokens
    function () payable {
        uint amount;

        // When there is enough ETH in the contract to double the ETH sent
        if (this.balance >= msg.value){
            amount = msg.value * 2; // do it two it!
            DonationDoubled(msg.sender, amount);
        } else {
            amount = msg.value + this.balance;
            DonationSentButNotDoubled(msg.sender, amount);
        }

        // Send the ETH to the beneficiary so that they receive Campaign tokens
        if (!beneficiary.proxyPayment.value(amount)(msg.sender))
            throw;
    }

    event DonationDeposited4Doubling(address indexed sender, uint amount);
    event DonationDoubled(address indexed sender, uint amount);
    event DonationSentButNotDoubled(address indexed sender, uint amount);
}
