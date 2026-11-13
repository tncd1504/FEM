function gcoord=coord(nnode,num_last_nodey)
%----------------------------------------------------------
%  Purpose:
%     Creating element coordinate node matrices
%
%  Synopsis:
%     gcoord=coord(node)
%
%  Variable Description:
%     gcoord - global coordinate matrix
%     nnode - total number of nodes in system
%     num_last_nodey - number of last nodal on y axis  
%-----------------------------------------------------------

theta=80; %(degree)
R=25;%7.62;%25;     %(ft)
L=50;%15.24;%50;     %(ft)  

gcoord=zeros(nnode,3);
distance=0.5*L/(num_last_nodey-1);

jumptheta=0.5*theta*pi/(180*(num_last_nodey-1));
theta1=jumptheta;

gcoord(1,:)=[0 0 0];      % coordinate of 1-th nodal
k=1;

for i=1:(num_last_nodey-1)
    k=k+num_last_nodey;
    l=2*R*sin(theta1/2);
    %-------------------------------------------------------------
    % chieu dai mot canh cua phan tu    
    %    2 __________ 3
    %     \     l    /
    %      \        /  
    %     R \      / R  
    %        \    /    
    %         \  /    
    %          1           
    % dinh ly cosin trong tam giac
    % a^2 = b^2 + c^2 - 2bc*cos(231)
    % l^2 = sqrt(R^2 + R^2 - 2RRcos(theta1))
    % l   = sqrt(2R^2(1-cos(theta1))); cos(a)=cos(a/2)^2-sin(a/2)^2
    % l   = 2*R*sin(theta1/2)
    % chieu xuong truc x
    % x = l*cos(theta1)
    % chieu xuong truc y
    % z = -l*sin(theta1)
    %--------------------------------------------------------------
    x=l*cos(theta1/2);
    z=-l*sin(theta1/2);
    gcoord(k,:)=[x 0.0 z];
    theta1=theta1+jumptheta;
end
% chen toa do nut theo phuong y vao ma tran toa do nut tong the
for i=2:num_last_nodey       % y axis
    jump=0;     
    for j=1:num_last_nodey   % x axis
        gcoord(i+jump,:)=gcoord(i+jump-1,:)+[0 distance 0];
        jump=jump+num_last_nodey;
    end
end

%gcoord