function ff=Cal_Load(nel,nnel,num_last_nodey,sdof)
% vector luc
ff=zeros(sdof,1);          % system force vector

Deadload=90; %(lb/ft^2)    % tai trong ban than tren mot don vi chieu dai

Sxq=2*pi*25*50*80/(360*4); % Sxq = 2*pi*R*alpha*L/(360*4) square of 1/4 

f1=Sxq*Deadload/(nel*nnel);% transverse force at one node

ff(3)=-f1;                 %transverse force at node 1
count=3;

% Upper boundary along y axis
for inode=2:(num_last_nodey-1) 
    ffdof=inode*6-3;
    ff(ffdof,1)=-2*f1;
end
% The last node on upper boundary along y axis
inode=inode+1;
ffdof=inode*6-3;
ff(ffdof,1)=-f1;

% Left boundary along x axis
inode=num_last_nodey+1;
for i=1:(num_last_nodey-2)
    ffdof=inode*6-3;
    ff(ffdof,1)=-2*f1;
    inode=inode+num_last_nodey;
end
% Right boundary along x axis
inode=2*num_last_nodey;
for i=1:(num_last_nodey-2)
    ffdof=inode*6-3;
    ff(ffdof,1)=-2*f1;
    inode=inode+num_last_nodey;
end
% Inside
inode=num_last_nodey+1;
for i=1:(num_last_nodey-2)
    inode=inode+1;
    ffdof=inode*6-3;
    ff(ffdof,1)=-4*f1;
end
for i=1:(num_last_nodey-3)
    inode=inode+2;
    for j=1:(num_last_nodey-2)
        inode=inode+1;
        ffdof=inode*6-3;
        ff(ffdof,1)=-4*f1;
    end
end
% The last node on left boundary along x axis
inode=inode+2;
ffdof=inode*6-3;
ff(ffdof,1)=-f1;

% Lower boundary along y axis
for i=1:(num_last_nodey-2)
    inode=inode+1;
    ffdof=inode*6-3;
    ff(ffdof,1)=-2*f1;
end
% The last node on right boundary along x axis
inode=inode+1;
ffdof=inode*6-3;
ff(ffdof,1)=-f1;
