%--------------------------------------------------------------------------
% PURPOSE 
%    Plate problem use MIN3 of Hughes
%    Analysic vibration for square plate
%--------------------------------------------------------------------------
%   Coded by Ho Huu Vinh                                              
%   FOSAT Group – HCMC, Vietnam                                             
%   Email: hohuuvinh90@gmail.com or hohuuvingspkt@gmail.com
%   Last modified: February 2013                                          
%--------------------------------------------------------------------------
close all; clear all; clc
format short;
global gcoord nodes nnode nel nx ny method
method = 'T3';
E = 2e11;
rho = 8000;
poisson = 0.3;
L = 1;                   % chieu dai tam
H = 1;                   % chieu rong tam
kapa = 5/6;
disp('__________________________________________')
thick = input('Chieu day tam (t=1:tam day;t=2:tam mong):');
if thick == 1
    t = L*0.1;               % chieu day tam
elseif thick == 2
    t = L*0.005;             % chieu day tam
end
I = t^3/12;
% ma tran vat lieu bien dang uong
Db = I*E/(1-poisson^2)*[1    poisson    0
    poisson   1     0
    0     0 (1-poisson)/2];
% ma tran vat lieu bien dang cat
Ds = kapa*t*E/2/(1+poisson)*[1  0
    0  1];
nx = 20; % so phan tu theo phuong x
ny = 20;  % so phan tu theo phuong y
nel= 2*nx*ny;            % number of elements
nnel=3;                  % number of nodes per element
ndof=3;                  % number of dofs per node
nnode=(nx+1)*(ny+1);     % total number of nodes in system
sdof=nnode*ndof;         % total system dofs
edof=nnel*ndof;          % degrees of freedom per element
Type_element = 'T3';     % loai phan tu
[nodes,gcoord] = mesh_square_plate(Type_element,L,H,nx,ny);
%------------------------------ Plot grid ---------------------------------
%     plot_mesh(Type_element,gcoord,nodes,nel)
%---------------------------- buondary condition---------------------------
type_condition = 'SSSS';
[bcdof,bcval]=boundary_condition(type_condition,ndof,nx,ny);
% ma tran doi dau
T = [1  0  0  0  0  0  0  0  0
    0  0  1  0  0  0  0  0  0
    0 -1  0  0  0  0  0  0  0
    0  0  0  1  0  0  0  0  0
    0  0  0  0  0  1  0  0  0
    0  0  0  0 -1  0  0  0  0
    0  0  0  0  0  0  1  0  0
    0  0  0  0  0  0  0  0  1
    0  0  0  0  0  0  0 -1  0];
%--------------------------------------------------------------------------
%                          tinh ma tran do cung
%--------------------------------------------------------------------------
[point,weight]=get_Gauss_T3(3);
K = zeros(sdof,sdof);  % khai bao ma tran do cung ban dau la zeros
M = zeros(sdof,sdof);     % khai bao matran tai toan cuc ban dau
for iel=1:nel             % vong lap qua cac phan tu de tinh K
    nd = nodes(iel,:);    % cac nut cua phan tu thu i
    xcoord = gcoord(nd,1);  % toa do phuong x cho cac nut cua phan tu
    ycoord = gcoord(nd,2);  % toa do phuong y cho cac nut cua phan tu
    % vong lap qua cac diem Gauss
    kb = zeros(edof,edof);
    ks = zeros(edof,edof);
    me  = zeros(edof,edof);
    for inth=1:length(weight)
        x = point(inth,1);         % sampling point in x-axis
        y = point(inth,2);
        wt = weight(inth);         % weight in x-axis
        % tinh ham dang va dao ham cua no
        [N,dNdxi,dNdeta] = shape_T3(x,y);
        % Tinh Jacobi
        [jacob] = cal_jacobi(nnel,dNdxi,dNdeta,xcoord,ycoord);
        detjacob = det(jacob); % dinh thuc Jacobian
        invjacob = inv(jacob); % nghich dao Jacobian
        % dao ham ham dang dang theo x va theo y
        [dNdx,dNdy] = dNx_dNy(nnel,dNdxi,dNdeta,invjacob);
        %----------------------
        % Ma tran bien dang uon
        %--------------------------------------------
        % Tinh theo bac tu do (theta)
        % Bb = [0  0   dNx1 0  0   dNx2  0  0   dNx3
        %       0 dNy1  0   0 dNy2  0    0 dNy3  0
        %       0 dNx1 dNy1 0 dNx2 dNy2  0 dNx3 dNy3];
        %--------------------------------------------
        clear Bb
        Bb(1,3:3:edof)   = dNdx;
        Bb(2,2:3:edof-1) = dNdy;
        Bb(3,2:3:edof-1) = dNdx;
        Bb(3,3:3:edof)   = dNdy;
        kb = kb + Bb'*Db*Bb*wt*detjacob;
        %----------------------
        % Ma tran bien dang cat
        %----------------------------
        % Tinh theo bac tu do (theta)
        % Bs = [dNx   dLx   dHx+N
        %       dNy  dLy+N    dHy]
        %----------------------------
        clear Bs
        [a1,a2,a3,b1,b2,b3,h]=cal_side(xcoord,ycoord);
        [Bs] = cal_Bs_MIN3(dNdx,dNdy,N,a1,a2,a3,b1,b2,b3);
        %------------------------------------
        G = E/(2*(1+poisson));                  % modun dan hoi truot
        Ds = kapa*t^3*G/(t^2+0.1*h^2)*eye(2,2); % ma tran vat lieu sau khi hieu chinh
        ks = ks + Bs'*Ds*Bs*wt*detjacob;
        % tinh ma tran khoi luong
        NN = zeros(ndof,3*nnel);
        NN(1,1:3:3*nnel-2) = N;
        NN(2,2:3:3*nnel-1) = N;
        NN(3,3:3:3*nnel)   = N;
        mrho = rho*[t 0 0; 0 t^3/12 0; 0 0 t^3/12];
        me = me + NN'*mrho*NN*wt*detjacob;
    end
    % ma tran do cung phan tu
    ke = kb + ks;
    % Lap ghep vao ma tran Ke vao K toan cuc
    index=index_assemble(nd,nnel,ndof);
    K(index,index)=K(index,index)+ke;
    M(index,index)=M(index,index)+me;
end
%--------------------------------------------------------------------------
%                   ap dieu kien bien va tinh mode dao dong
%--------------------------------------------------------------------------
[lamda,modeN]=eigen(K,M,bcdof);
Dm =(E*t^3)/(12*(1-poisson^2));
N =(rho*t*L^4/Dm);
freq = sqrt(sqrt(lamda*N));
plot_analysis(type_condition,t,L,freq,modeN)



